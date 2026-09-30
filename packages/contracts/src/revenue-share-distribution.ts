import { z } from "zod";
import { applicationIdSchema } from "./application-id.js";
import { campaignIdSchema, stellarAccountIdSchema } from "./campaign.js";
import { correlationIdSchema } from "./correlation-id.js";
import { stroopsSchema } from "./funding-intent.js";
import { revenueShareDistributionIdSchema } from "./revenue-share-distribution-id.js";
import { periodSchema } from "./sme-evidence.js";
import { stellarFailureReasonSchema } from "./stellar-failure-reason.js";

/**
 * Revenue-share distribution wire contract.
 *
 * A distribution is a **single classic transaction with one native payment per
 * recipient** (`D2`): a signed envelope the SME authorizes with Freighter, not
 * the AI. Money crosses this boundary the same way it does in
 * `funding-intent.ts`: an integer stroop count rendered as a **decimal string**,
 * never a JSON number, because a JavaScript number is a double and cannot
 * represent a stroop count exactly above 2^53. `stroopsSchema` parses that
 * positive decimal string into a `bigint`; the inverse encoding belongs to
 * whoever serialises a response.
 *
 * The terms below are **exactly the facts the signed envelope commits to**, and
 * nothing else: the caller declares them at prepare time and echoes them back
 * at submit, where the XDR port re-derives every one of them from the signed
 * envelope. That is what keeps the persisted record unable to disagree with the
 * signed transaction. A contributor's traceability has no envelope field to
 * bind to, so the caller maps its allocation to `(accountId, amountStroops)`
 * before prepare and any contributor link is a presentation concern outside
 * this contract (`D1`).
 */

// ---------------------------------------------------------------------------
// Local helpers, intentionally duplicated from `funding-intent.ts`.
//
// This slice may not modify `funding-intent.ts`, so the uint64 and memo-byte
// logic is copied here verbatim rather than shared. A future extraction into a
// common `stellar-primitives` module is the right follow-up once a third caller
// needs it; until then the duplication is deliberate and the two copies are
// expected to stay behaviourally identical.
// ---------------------------------------------------------------------------

/**
 * The UTF-8 byte length of a string, computed without `TextEncoder`:
 * `@vaqcrow/contracts` compiles against `lib: ["ES2023"]` with neither DOM nor
 * Node types, because its exports must stay portable to both. Iterating code
 * points rather than code units is what makes an astral character count as four
 * bytes instead of two.
 */
function utf8ByteLength(value: string): number {
  let bytes = 0;

  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;

    if (point <= 0x7f) bytes += 1;
    else if (point <= 0x7ff) bytes += 2;
    else if (point <= 0xffff) bytes += 3;
    else bytes += 4;
  }

  return bytes;
}

/**
 * A Stellar text memo is capped at 28 **bytes**, not characters: the envelope
 * builder measures the UTF-8 encoding, so an accented or non-Latin character
 * costs more than one. `null` is the declared absence of a memo, distinct from
 * an empty string.
 */
const MEMO_MAX_BYTES = 28;

const memoShape = z
  .string()
  .trim()
  .refine((value) => utf8ByteLength(value) <= MEMO_MAX_BYTES, {
    message: `must be at most ${MEMO_MAX_BYTES} bytes when UTF-8 encoded`
  })
  .nullable();

/**
 * A uint64 rendered as a decimal string. JavaScript cannot represent a uint64
 * exactly as a number, so the sequence travels as text and is bounded here
 * rather than trusted.
 */
const MAX_UINT64 = 18_446_744_073_709_551_615n;

const uint64StringShape = z
  .string()
  .regex(/^\d+$/, "must be a non-negative decimal integer string")
  .refine((value) => {
    // The regex check and this refinement both run, so a non-integer string
    // reaches here too. `BigInt` throws on one, and a thrown conversion must
    // read as "not a uint64" rather than escaping as a parse exception.
    try {
      return BigInt(value) <= MAX_UINT64;
    } catch {
      return false;
    }
  }, "must fit in an unsigned 64-bit integer");

/**
 * One destination of a distribution: where the money goes and how much. These
 * are exactly the two facts one `Operation.payment` encodes, so nothing else
 * belongs here — a traceability label the envelope cannot carry would advertise
 * a check that can never happen.
 */
export const distributionRecipientSchema = z.strictObject({
  accountId: stellarAccountIdSchema,
  amountStroops: stroopsSchema
});

export type DistributionRecipient = z.infer<typeof distributionRecipientSchema>;

export function parseDistributionRecipient(input: unknown): DistributionRecipient {
  return distributionRecipientSchema.parse(input);
}

/**
 * The distribution state machine, as the demo can actually produce it. Horizon
 * is the sole authority for the two terminal states; nothing in this codebase
 * sets them by hand.
 */
export const revenueShareDistributionStateSchema = z.enum(["submitted", "confirmed", "failed"]);

export type RevenueShareDistributionState = z.infer<typeof revenueShareDistributionStateSchema>;

export function parseRevenueShareDistributionState(input: unknown): RevenueShareDistributionState {
  return revenueShareDistributionStateSchema.parse(input);
}

/**
 * Adds an issue per offending recipient index. A recipient must be a distinct
 * destination and must not be the source account either: paying yourself moves
 * no money to anyone and would only produce a signed transaction that changes
 * nothing.
 *
 * The terms, the prepare command and the snapshot each carry the source
 * account and call this with it, so all three enforce both rules.
 */
function checkDistributionRecipients(
  recipients: readonly DistributionRecipient[],
  sourceAccountId: string,
  context: z.RefinementCtx
): void {
  const seen = new Set<string>();

  recipients.forEach((recipient, index) => {
    if (recipient.accountId === sourceAccountId) {
      context.addIssue({
        code: "custom",
        path: ["recipients", index, "accountId"],
        message: "A revenue-share distribution cannot pay its own source account"
      });
    }

    // One payment per destination (`D2`): two rows for the same account would
    // be a duplicate allocation, not a second payment the envelope can express
    // unambiguously.
    if (seen.has(recipient.accountId)) {
      context.addIssue({
        code: "custom",
        path: ["recipients", index, "accountId"],
        message: "Recipient accountIds must be unique"
      });
    }

    seen.add(recipient.accountId);
  });
}

const revenueShareDistributionTermsShape = {
  /** The network name, carried for humans; never inferred from an interface. */
  network: z.string().trim().min(1),
  /**
   * The passphrase a signature commits to. Deliberately not trimmed: it is an
   * opaque cryptographic input, not display text.
   */
  networkPassphrase: z.string().min(1),
  sourceAccountId: stellarAccountIdSchema,
  sourceSequence: uint64StringShape,
  memo: memoShape,
  expiresAt: z.iso.datetime({ offset: true }),
  recipients: z.array(distributionRecipientSchema).min(1)
} as const;

/**
 * The distribution's declared terms: the network identity that determines what
 * a signature means, the source, sequence and memo, and each recipient's
 * account and amount. Every one of these is a fact the signed envelope encodes,
 * so verification can compare the envelope against them one for one. A
 * distribution that pays nobody is not expressible: `recipients` holds at least
 * one destination.
 */
export const revenueShareDistributionTermsSchema = z
  .strictObject(revenueShareDistributionTermsShape)
  .superRefine((value, context) => {
    checkDistributionRecipients(value.recipients, value.sourceAccountId, context);
  });

export type RevenueShareDistributionTerms = z.infer<typeof revenueShareDistributionTermsSchema>;

export function parseRevenueShareDistributionTerms(input: unknown): RevenueShareDistributionTerms {
  return revenueShareDistributionTermsSchema.parse(input);
}

/**
 * The facts the server derived a distribution from, returned with the prepared
 * distribution so a person sees WHY each investor is paid what they are paid
 * (T5a, `revenue-share-calculation-evidence.md`).
 *
 * Every amount is a **decimal string**, never a JSON number: the same rule the
 * rest of this contract applies to money. Amounts in `*Ars` are whole pesos (the
 * domain engine's minor unit for the demo) and amounts in `*Stroops` are stroops;
 * the conversion between them is declared in `conversion`, not inferred.
 *
 * `simulated` is the literal `true`: the sales series, the approved limit and
 * the ARS/stroop conversion are all synthetic, and a derivation that did not
 * say so would claim a market quote the demo does not have.
 */
const nonNegativeIntegerStringShape = z.string().regex(/^\d+$/, "must be a non-negative decimal integer string");

export const revenueShareDerivationSchema = z.strictObject({
  ruleVersion: z.string().trim().min(1),
  /** Integer basis points: 450 is 4.50 %. */
  rateBps: z.int().min(1).max(10_000),
  /** The single period the obligation was computed on (YYYY-MM). */
  period: periodSchema,
  salesArs: nonNegativeIntegerStringShape,
  obligationArs: nonNegativeIntegerStringShape,
  /** Periods of the series that were not eligible, reported rather than hidden. */
  excludedPeriods: z.array(
    z.strictObject({
      period: periodSchema,
      status: z.enum(["missing", "anomalous"]),
      reason: z.enum(["missing_data", "requires_review"])
    })
  ),
  /**
   * `stroops = floor(obligationArs x goalStroops / approvedLimitArs)`: investors
   * receive in the same proportion they funded, not at an invented market rate.
   */
  conversion: z.strictObject({
    goalStroops: nonNegativeIntegerStringShape,
    approvedLimitArs: nonNegativeIntegerStringShape,
    totalStroops: nonNegativeIntegerStringShape
  }),
  simulated: z.literal(true)
});

export type RevenueShareDerivation = z.infer<typeof revenueShareDerivationSchema>;

export function parseRevenueShareDerivation(input: unknown): RevenueShareDerivation {
  return revenueShareDerivationSchema.parse(input);
}

/**
 * What the caller declares before the API derives and builds the multi-payment
 * envelope: the source, the case (application and settled campaign) and an
 * optional memo. It deliberately carries **no recipients or amounts**: who is
 * paid and how much is derived by the server from the campaign's contributors
 * and the SME's sales (T5a), so a client cannot declare a split the case does
 * not support.
 */
export const prepareRevenueShareDistributionCommandSchema = z.strictObject({
  sourceAccountId: stellarAccountIdSchema,
  applicationId: applicationIdSchema,
  campaignId: campaignIdSchema,
  memo: memoShape
});

export type PrepareRevenueShareDistributionCommand = z.infer<
  typeof prepareRevenueShareDistributionCommandSchema
>;

export function parsePrepareRevenueShareDistributionCommand(
  input: unknown
): PrepareRevenueShareDistributionCommand {
  return prepareRevenueShareDistributionCommandSchema.parse(input);
}

/**
 * What the prepare response returns and what the client echoes at submit: the
 * terms, plus the id that names the distribution, the unsigned envelope to
 * sign, the case it was derived for, and the derivation itself.
 *
 * `applicationId` and `campaignId` deliberately sit **outside**
 * `revenueShareDistributionTermsSchema`. The terms are exactly what the XDR
 * port binds to the signed envelope, and neither id is encoded in an envelope.
 * Folding them into the terms would advertise a check that can never happen.
 * They are instead checked by re-derivation at submit: the recipients and
 * amounts the envelope commits to must equal what the server derives for that
 * case.
 */
export const preparedRevenueShareDistributionSchema = revenueShareDistributionTermsSchema.safeExtend({
  distributionId: revenueShareDistributionIdSchema,
  xdr: z.string().min(1),
  applicationId: applicationIdSchema,
  campaignId: campaignIdSchema,
  derivation: revenueShareDerivationSchema
});

export type PreparedRevenueShareDistribution = z.infer<typeof preparedRevenueShareDistributionSchema>;

export function parsePreparedRevenueShareDistribution(
  input: unknown
): PreparedRevenueShareDistribution {
  return preparedRevenueShareDistributionSchema.parse(input);
}

/**
 * The submit command declares the distribution's terms so the server can bind
 * the persisted record to the signed envelope (`D4`), and names the case so the
 * server can re-derive the recipients and amounts and refuse terms that differ
 * (`derivation_mismatch`).
 *
 * `applicationId` and `campaignId` are siblings of `terms`, not members of it,
 * for the same reason they are not terms: the envelope does not carry them. Both
 * are required and non-null: a distribution that cannot be re-derived cannot be
 * verified.
 */
export const submitRevenueShareDistributionCommandSchema = z.strictObject({
  signedXdr: z.string().min(1),
  terms: revenueShareDistributionTermsSchema,
  applicationId: applicationIdSchema,
  campaignId: campaignIdSchema
});

export type SubmitRevenueShareDistributionCommand = z.infer<
  typeof submitRevenueShareDistributionCommandSchema
>;

export function parseSubmitRevenueShareDistributionCommand(
  input: unknown
): SubmitRevenueShareDistributionCommand {
  return submitRevenueShareDistributionCommandSchema.parse(input);
}

/**
 * What the status endpoint reports. It mirrors the persisted record minus the
 * signed envelope: a status read reports what was authorized, not the artifact
 * the caller already holds.
 *
 * Two fields are derived rather than stored: `explorerUrl` is built from the
 * hash the API already persists, and `failureReason` carries the closed
 * vocabulary from `stellar-failure-reason.ts`, never Horizon's own result code.
 */
export const revenueShareDistributionSnapshotSchema = z
  .strictObject({
    distributionId: revenueShareDistributionIdSchema,
    ...revenueShareDistributionTermsShape,
    state: revenueShareDistributionStateSchema,
    transactionHash: z.string().trim().min(1),
    applicationId: applicationIdSchema.nullable(),
    /** The settled campaign the distribution was derived from; null for one recorded before the link existed. */
    campaignId: campaignIdSchema.nullable(),
    explorerUrl: z.url(),
    failureReason: stellarFailureReasonSchema.nullable(),
    lastCorrelationId: correlationIdSchema,
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .superRefine((value, context) => {
    // The snapshot mirrors the write model: the terms' own recipient rules —
    // distinct destinations, never the source — apply here too, so a persisted
    // read cannot report an allocation the write model would refuse.
    checkDistributionRecipients(value.recipients, value.sourceAccountId, context);

    // The equivalence form, mirroring the table's CHECK in the migration: a
    // failed distribution must say why, and no other state may carry a reason
    // for a state it is not in. Leaving this to the reader would let a
    // `submitted` snapshot advertise a failure that has not happened.
    if ((value.state === "failed") !== (value.failureReason !== null)) {
      context.addIssue({
        code: "custom",
        path: ["failureReason"],
        message: "A failure reason is present exactly when the state is failed"
      });
    }
  });

export type RevenueShareDistributionSnapshot = z.infer<typeof revenueShareDistributionSnapshotSchema>;

export function parseRevenueShareDistributionSnapshot(
  input: unknown
): RevenueShareDistributionSnapshot {
  return revenueShareDistributionSnapshotSchema.parse(input);
}

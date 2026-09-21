import { z } from "zod";
import { applicationIdSchema } from "./application-id.js";
import { correlationIdSchema } from "./correlation-id.js";
import { fundingIntentIdSchema } from "./funding-intent-id.js";

/**
 * Funding-intent wire contract.
 *
 * Money is integer-only across this boundary and always crosses the wire as a
 * **decimal string**, never a JSON number: a JavaScript number is a double and
 * loses precision above 2^53, while a funding amount is a stroop count that
 * must survive the round trip exactly. `stroopsSchema` therefore parses a
 * positive decimal integer string and yields a `bigint`; the inverse encoding
 * (bigint to string) belongs to whoever serialises a response.
 *
 * The intent's terms are the fields the signed envelope actually commits to,
 * plus the network identity that determines what a signature means. They are
 * declared by the caller at prepare time and echoed back at submit, where the
 * XDR port re-derives every one of them from the signed envelope. That is what
 * makes the persisted record unable to disagree with the transaction that was
 * signed (`D12`).
 */

/** A positive decimal integer string, parsed to `bigint`. */
export const stroopsSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "must be a positive decimal integer string")
  .transform((value) => BigInt(value));

/**
 * The funding-intent state machine, as the demo can actually produce it.
 *
 * #24 could persist exactly one state (`D3`, acceptance criterion 3): the prepare
 * step is stateless, so a row is only ever written by a verified submission.
 * #25 adds the two terminal states, and Horizon is the sole authority for both —
 * nothing in this codebase sets them by hand (`DEMO.md` §11: "No cambiar un
 * estado a confirmado manualmente").
 *
 * The longer machine in `product.md` §8.1 (`draft -> … -> awaiting_signature ->
 * signed -> submitted -> confirmed`) is the production roadmap beyond the demo,
 * so `manual_review` and every pre-submission state stay out of this set on
 * purpose rather than by omission.
 */
export const fundingIntentStateSchema = z.enum(["submitted", "confirmed", "failed"]);

export type FundingIntentState = z.infer<typeof fundingIntentStateSchema>;

/**
 * The UTF-8 byte length of a string, computed without `TextEncoder`:
 * `@vaqcrow/contracts` compiles against `lib: ["ES2023"]` with neither DOM nor
 * Node types, because its exports must stay portable to both. Iterating code
 * points rather than code units is what makes an astral character count as four
 * bytes instead of two — the same answer the SDK's `stringToUint8Array` gives.
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
 * builder measures the UTF-8 encoding (`stringToUint8Array(value).length`), so
 * an accented or non-Latin character costs more than one. A character-based cap
 * would accept memos the builder then refuses — which a Spanish-language demo
 * makes likely rather than theoretical.
 *
 * `null` is the declared absence of a memo — distinct from an empty string,
 * which is a memo that happens to be blank.
 */
const MEMO_MAX_BYTES = 28;

const memoShape = z
  .string()
  .trim()
  .refine((value) => utf8ByteLength(value) <= MEMO_MAX_BYTES, {
    message: `must be at most ${MEMO_MAX_BYTES} bytes when UTF-8 encoded`
  })
  .nullable();

/** An account identifier: a public key, never key material. */
const accountIdShape = z.string().trim().min(1);

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

const fundingIntentTermsShape = {
  /** The network name, carried for humans; never inferred from an interface. */
  network: z.string().trim().min(1),
  /**
   * The passphrase a signature commits to. Deliberately not trimmed: it is an
   * opaque cryptographic input, not display text.
   */
  networkPassphrase: z.string().min(1),
  sourceAccountId: accountIdShape,
  sourceSequence: uint64StringShape,
  destinationAccountId: accountIdShape,
  amountStroops: stroopsSchema,
  memo: memoShape,
  expiresAt: z.iso.datetime({ offset: true })
} as const;

/**
 * The intent's declared terms. Every field here is one the signed envelope
 * encodes, so verification can compare the envelope against them one for one.
 */
export const fundingIntentTermsSchema = z.strictObject(fundingIntentTermsShape);

export type FundingIntentTerms = z.infer<typeof fundingIntentTermsSchema>;

export const prepareFundingIntentCommandSchema = z
  .strictObject({
    sourceAccountId: accountIdShape,
    destinationAccountId: accountIdShape,
    amountStroops: stroopsSchema,
    memo: memoShape,
    applicationId: applicationIdSchema.nullable()
  })
  .superRefine((value, context) => {
    // Paying yourself is not a funding intent: it moves no money to anyone and
    // would only produce a signed transaction that changes nothing.
    if (value.sourceAccountId === value.destinationAccountId) {
      context.addIssue({
        code: "custom",
        path: ["destinationAccountId"],
        message: "A funding intent cannot pay its own source account"
      });
    }
  });

export type PrepareFundingIntentCommand = z.infer<typeof prepareFundingIntentCommandSchema>;

/**
 * What the prepare response returns and what the client echoes at submit: the
 * terms, plus the id that names the intent, the unsigned envelope to sign, and
 * the declared application link.
 *
 * `applicationId` deliberately sits **outside** `fundingIntentTermsSchema`. The
 * terms are exactly what `FundingIntentXdrPort.verify` binds to the signed
 * envelope, and `applicationId` is not encoded in an envelope — no transaction
 * carries it. Folding it into the terms would advertise a check that can never
 * happen. It travels as declared metadata alongside the terms instead: accepted
 * by the prepare command, echoed here, echoed back by the client, and persisted
 * at submit (`D4`, traceability only).
 */
export const preparedFundingIntentSchema = fundingIntentTermsSchema.safeExtend({
  intentId: fundingIntentIdSchema,
  xdr: z.string().min(1),
  applicationId: applicationIdSchema.nullable()
});

export type PreparedFundingIntent = z.infer<typeof preparedFundingIntentSchema>;

/**
 * The submit command declares the intent's terms so the server can bind the
 * persisted record to the signed envelope (`D12`): the prepare step persists
 * nothing, so the terms the person was shown are the only thing the server can
 * verify the envelope against.
 *
 * `applicationId` is a sibling of `intent`, not a member of it, for the same
 * reason it is not a term: verification cannot check a value the envelope does
 * not carry. It is required-but-nullable, like every other declared field here,
 * so a client that drops it is refused rather than silently losing the link.
 */
export const submitFundingIntentCommandSchema = z.strictObject({
  signedXdr: z.string().min(1),
  intent: fundingIntentTermsSchema,
  applicationId: applicationIdSchema.nullable()
});

export type SubmitFundingIntentCommand = z.infer<typeof submitFundingIntentCommandSchema>;

/**
 * What the status endpoint reports. It mirrors the persisted record minus the
 * signed envelope: a status read reports what was authorized, not the artifact
 * the caller already holds. `applicationId` is nullable because #24 does not
 * require an approved application (`D4`) — the link is traceability only.
 */
export const fundingIntentSnapshotSchema = z.strictObject({
  intentId: fundingIntentIdSchema,
  ...fundingIntentTermsShape,
  state: fundingIntentStateSchema,
  transactionHash: z.string().trim().min(1),
  applicationId: applicationIdSchema.nullable(),
  lastCorrelationId: correlationIdSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true })
});

export type FundingIntentSnapshot = z.infer<typeof fundingIntentSnapshotSchema>;

export function parseStroops(input: unknown): bigint {
  return stroopsSchema.parse(input);
}

export function parseFundingIntentState(input: unknown): FundingIntentState {
  return fundingIntentStateSchema.parse(input);
}

export function parseFundingIntentTerms(input: unknown): FundingIntentTerms {
  return fundingIntentTermsSchema.parse(input);
}

export function parsePrepareFundingIntentCommand(input: unknown): PrepareFundingIntentCommand {
  return prepareFundingIntentCommandSchema.parse(input);
}

export function parsePreparedFundingIntent(input: unknown): PreparedFundingIntent {
  return preparedFundingIntentSchema.parse(input);
}

export function parseSubmitFundingIntentCommand(input: unknown): SubmitFundingIntentCommand {
  return submitFundingIntentCommandSchema.parse(input);
}

export function parseFundingIntentSnapshot(input: unknown): FundingIntentSnapshot {
  return fundingIntentSnapshotSchema.parse(input);
}

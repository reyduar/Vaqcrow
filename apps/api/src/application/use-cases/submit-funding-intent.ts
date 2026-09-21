import { parseFundingIntentSnapshot } from "@vaqcrow/contracts";
import type {
  CorrelationId,
  FundingIntentId,
  FundingIntentSnapshot,
  SubmitFundingIntentCommand
} from "@vaqcrow/contracts";
import type { FundingIntentXdrPort } from "../ports/funding-intent-xdr-port.js";
import type {
  FundingIntentRecord,
  FundingIntentRepositoryPort
} from "../ports/funding-intent-repository-port.js";

/**
 * Verifies a signed envelope against the intent it claims to be, then persists
 * it.
 *
 * This is where `D12` lives. The prepare step persists nothing (`D2`) and the
 * client owns the terms (`D4`), so the server holds no independent memory of
 * what it built: the submit command declares the intent's terms, and the XDR
 * port re-derives every one of them from the signed envelope. A tampered
 * envelope fails the signature check; an envelope whose source, sequence,
 * destination, amount, memo or timebounds differ from the declared intent fails
 * as a mismatch. The guarantee that follows is precise and not tautological —
 * the record Vaqcrow persists cannot disagree with the transaction that was
 * actually signed.
 *
 * Nothing is written until verification succeeds, so a refused envelope leaves
 * no trace to reconcile later.
 */

export interface SubmitFundingIntentDeps {
  readonly xdr: FundingIntentXdrPort;
  /**
   * A verified submission writes one row and reads nothing back, so that is the
   * whole repository surface it depends on — `#25`'s confirmation operations are
   * not part of this use case's contract.
   */
  readonly repository: Pick<FundingIntentRepositoryPort, "submit">;
}

export type SubmitFundingIntentError =
  | { readonly code: "xdr_rejected"; readonly reason: string }
  | { readonly code: "idempotency_conflict" | "unavailable" };

export type SubmitFundingIntentResult =
  | {
      readonly ok: true;
      readonly value: { readonly intent: FundingIntentSnapshot; readonly applied: boolean };
    }
  | { readonly ok: false; readonly error: SubmitFundingIntentError };

export async function submitFundingIntent(
  deps: SubmitFundingIntentDeps,
  input: {
    readonly intentId: FundingIntentId;
    readonly command: SubmitFundingIntentCommand;
    readonly correlationId: CorrelationId;
  }
): Promise<SubmitFundingIntentResult> {
  const terms = input.command.intent;

  const verified = deps.xdr.verify({
    xdr: input.command.signedXdr,
    networkPassphrase: terms.networkPassphrase,
    sourceAccountId: terms.sourceAccountId,
    sourceSequence: terms.sourceSequence,
    destinationAccountId: terms.destinationAccountId,
    amountStroops: terms.amountStroops,
    expiresAt: terms.expiresAt,
    ...(terms.memo === null ? {} : { memo: terms.memo })
  });

  if (!verified.ok) {
    // The port's own code is carried as `reason` for logs and tests only; the
    // route sanitizes it away, because naming the failing field to a caller
    // would describe the envelope back to whoever tampered with it.
    return {
      ok: false,
      error: { code: "xdr_rejected", reason: verified.error.reason ?? verified.error.code }
    };
  }

  const submitted = await deps.repository.submit({
    // The persisted facts come from what verification *proved* about the
    // envelope, not from what the caller declared; only the network identity
    // and the sequence — which the port reports back without them — are taken
    // from the terms the verification ran against.
    record: {
      intentId: input.intentId,
      network: terms.network,
      networkPassphrase: terms.networkPassphrase,
      sourceAccountId: verified.value.sourceAccountId,
      sourceSequence: terms.sourceSequence,
      destinationAccountId: verified.value.destinationAccountId,
      amountStroops: verified.value.amountStroops,
      expiresAt: verified.value.expiresAt,
      signedXdr: input.command.signedXdr,
      transactionHash: verified.value.transactionHash,
      ...(verified.value.memo === undefined ? {} : { memo: verified.value.memo }),
      // The declared application link is the one thing on this record that
      // verification cannot corroborate, because no envelope encodes it. It is
      // persisted as declared (`D4`, traceability only) and never invented: an
      // absent link stays absent rather than becoming a fabricated null link.
      ...(input.command.applicationId === null
        ? {}
        : { applicationId: input.command.applicationId })
    },
    correlationId: input.correlationId
  });

  if (!submitted.ok) {
    return submitted.error.code === "idempotency_conflict"
      ? { ok: false, error: { code: "idempotency_conflict" } }
      : { ok: false, error: { code: "unavailable" } };
  }

  try {
    return {
      ok: true,
      value: {
        intent: toFundingIntentSnapshot(submitted.value.record),
        applied: submitted.value.applied
      }
    };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}

/**
 * The one projection from a persisted record to the reported snapshot. Kept
 * module-private because this repo's use cases depend only on ports and
 * contracts — never on each other — and that isolation is worth a repeated
 * fifteen-line pure function.
 */
function toFundingIntentSnapshot(record: FundingIntentRecord): FundingIntentSnapshot {
  return parseFundingIntentSnapshot({
    intentId: record.intentId,
    network: record.network,
    networkPassphrase: record.networkPassphrase,
    sourceAccountId: record.sourceAccountId,
    sourceSequence: record.sourceSequence,
    destinationAccountId: record.destinationAccountId,
    // A round trip through the decimal string, never a float: the contract's
    // money invariant is re-checked on the way out as well as on the way in.
    amountStroops: record.amountStroops.toString(),
    memo: record.memo ?? null,
    expiresAt: record.expiresAt,
    state: record.state,
    transactionHash: record.transactionHash,
    applicationId: record.applicationId ?? null,
    lastCorrelationId: record.lastCorrelationId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  });
}

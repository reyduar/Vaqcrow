import { parseFundingIntentSnapshot } from "@vaqcrow/contracts";
import type { FundingIntentId, FundingIntentSnapshot } from "@vaqcrow/contracts";
import type {
  FundingIntentRecord,
  FundingIntentRepositoryPort
} from "../ports/funding-intent-repository-port.js";

/**
 * Reports the status of a persisted funding intent.
 *
 * The repository hands back the full record, signed envelope included; what a
 * caller is owed here is the *reported* snapshot — the intent and its state,
 * not the artifact the caller already holds. Projecting in the use case keeps
 * the transport free to encode, and keeps the signed XDR out of a status read.
 *
 * Identity fields are re-parsed rather than trusted: the repository boundary is
 * untrusted data, so a row that cannot satisfy the snapshot contract is a
 * corrupt read (`unavailable`), never a half-reported intent and never a 500.
 */

export type GetFundingIntentError = {
  readonly code: "not_found" | "unavailable";
};

export type GetFundingIntentResult =
  | { readonly ok: true; readonly value: FundingIntentSnapshot }
  | { readonly ok: false; readonly error: GetFundingIntentError };

export async function getFundingIntent(
  repository: FundingIntentRepositoryPort,
  intentId: FundingIntentId
): Promise<GetFundingIntentResult> {
  const found = await repository.findById(intentId);

  if (!found.ok) {
    return found.error.code === "not_found"
      ? { ok: false, error: { code: "not_found" } }
      : { ok: false, error: { code: "unavailable" } };
  }

  try {
    return { ok: true, value: toFundingIntentSnapshot(found.value) };
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

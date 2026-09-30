import { parseRevenueShareDistributionSnapshot } from "@vaqcrow/contracts";
import type {
  RevenueShareDistributionId,
  RevenueShareDistributionSnapshot
} from "@vaqcrow/contracts";
import { transactionExplorerUrl } from "../explorer-url.js";
import type {
  RevenueShareDistributionRecord,
  RevenueShareDistributionRepositoryPort
} from "../ports/revenue-share-distribution-repository-port.js";

/**
 * Reports the status of a persisted revenue-share distribution.
 *
 * The repository hands back the full record, signed envelope included; what a
 * caller is owed here is the *reported* snapshot — the distribution and its
 * state, not the artifact the caller already holds. Projecting in the use case
 * keeps the transport free to encode, and keeps the signed XDR out of a status
 * read.
 *
 * Identity fields are re-parsed rather than trusted: the repository boundary is
 * untrusted data, so a row that cannot satisfy the snapshot contract is a
 * corrupt read (`unavailable`), never a half-reported distribution and never a
 * 500.
 */

export type GetRevenueShareDistributionError = {
  readonly code: "not_found" | "unavailable";
};

export type GetRevenueShareDistributionResult =
  | { readonly ok: true; readonly value: RevenueShareDistributionSnapshot }
  | { readonly ok: false; readonly error: GetRevenueShareDistributionError };

/**
 * A status read needs exactly one repository operation, so it depends on exactly
 * that one. The confirmation surface must not oblige a caller that only reports
 * state to know about the polling operations it will never use.
 */
export type RevenueShareDistributionLookup = Pick<
  RevenueShareDistributionRepositoryPort,
  "findById"
>;

export interface GetRevenueShareDistributionDeps {
  readonly repository: RevenueShareDistributionLookup;
  /** The base a transaction link is built from. Normalised by configuration. */
  readonly explorerBaseUrl: string;
}

export async function getRevenueShareDistribution(
  deps: GetRevenueShareDistributionDeps,
  distributionId: RevenueShareDistributionId
): Promise<GetRevenueShareDistributionResult> {
  const found = await deps.repository.findById(distributionId);

  if (!found.ok) {
    return found.error.code === "not_found"
      ? { ok: false, error: { code: "not_found" } }
      : { ok: false, error: { code: "unavailable" } };
  }

  try {
    return {
      ok: true,
      value: toRevenueShareDistributionSnapshot(found.value, deps.explorerBaseUrl)
    };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}

/**
 * The one projection from a persisted record to the reported snapshot. Kept
 * module-private because this repo's use cases depend only on ports and
 * contracts — never on each other — and that isolation is worth a repeated pure
 * function.
 */
function toRevenueShareDistributionSnapshot(
  record: RevenueShareDistributionRecord,
  explorerBaseUrl: string
): RevenueShareDistributionSnapshot {
  return parseRevenueShareDistributionSnapshot({
    distributionId: record.distributionId,
    network: record.network,
    networkPassphrase: record.networkPassphrase,
    sourceAccountId: record.sourceAccountId,
    sourceSequence: record.sourceSequence,
    memo: record.memo ?? null,
    expiresAt: record.expiresAt,
    // A round trip through the decimal string, never a float: the contract's
    // money invariant is re-checked on the way out as well as on the way in.
    recipients: record.recipients.map((recipient) => ({
      accountId: recipient.accountId,
      amountStroops: recipient.amountStroops.toString()
    })),
    state: record.state,
    transactionHash: record.transactionHash,
    applicationId: record.applicationId ?? null,
    campaignId: record.campaignId ?? null,
    period: record.period ?? null,
    explorerUrl: transactionExplorerUrl(explorerBaseUrl, record.transactionHash),
    failureReason: record.failureReason ?? null,
    lastCorrelationId: record.lastCorrelationId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  });
}

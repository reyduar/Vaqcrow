import { parseRevenueShareDistributionSnapshot } from "@vaqcrow/contracts";
import type {
  CorrelationId,
  RevenueShareDistributionId,
  RevenueShareDistributionSnapshot,
  SubmitRevenueShareDistributionCommand
} from "@vaqcrow/contracts";
import { transactionExplorerUrl } from "../explorer-url.js";
import type {
  RevenueShareDistributionRecord,
  RevenueShareDistributionRepositoryPort
} from "../ports/revenue-share-distribution-repository-port.js";
import type { RevenueShareDistributionXdrPort } from "../ports/revenue-share-distribution-xdr-port.js";

/**
 * Verifies a signed distribution envelope against the terms it claims to
 * implement, then persists it.
 *
 * The prepare step persists nothing (`D2`) and the client owns the terms
 * (`D4`), so the server holds no independent memory of what it built: the submit
 * command declares the distribution's terms, and the XDR port re-derives every
 * one of them from the signed envelope. A tampered envelope fails the signature
 * check; an envelope whose source, sequence, recipient list, amounts, memo or
 * time bounds differ from the declared terms fails as a mismatch. The record
 * Vaqcrow persists therefore cannot disagree with the transaction that was
 * actually signed.
 *
 * Nothing is written until verification succeeds, so a refused envelope leaves
 * no trace to reconcile later.
 */

export interface SubmitRevenueShareDistributionDeps {
  readonly xdr: RevenueShareDistributionXdrPort;
  /**
   * A verified submission writes one row and reads nothing back, so that is the
   * whole repository surface it depends on — the confirmation operations are not
   * part of this use case's contract.
   */
  readonly repository: Pick<RevenueShareDistributionRepositoryPort, "submit">;
  /** The base a transaction link is built from. Normalised by configuration. */
  readonly explorerBaseUrl: string;
}

export type SubmitRevenueShareDistributionError =
  | { readonly code: "xdr_rejected"; readonly reason: string }
  | { readonly code: "idempotency_conflict" | "unavailable" };

export type SubmitRevenueShareDistributionResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly distribution: RevenueShareDistributionSnapshot;
        readonly applied: boolean;
      };
    }
  | { readonly ok: false; readonly error: SubmitRevenueShareDistributionError };

export async function submitRevenueShareDistribution(
  deps: SubmitRevenueShareDistributionDeps,
  input: {
    readonly distributionId: RevenueShareDistributionId;
    readonly command: SubmitRevenueShareDistributionCommand;
    readonly correlationId: CorrelationId;
  }
): Promise<SubmitRevenueShareDistributionResult> {
  const terms = input.command.terms;

  const verified = deps.xdr.verify({ xdr: input.command.signedXdr, terms });

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
    // envelope, not from what the caller declared; only the network identity and
    // the sequence — which the port reports back without them — are taken from
    // the terms the verification ran against.
    record: {
      distributionId: input.distributionId,
      network: terms.network,
      networkPassphrase: terms.networkPassphrase,
      sourceAccountId: verified.value.sourceAccountId,
      sourceSequence: terms.sourceSequence,
      recipients: verified.value.recipients,
      expiresAt: verified.value.expiresAt,
      signedXdr: input.command.signedXdr,
      transactionHash: verified.value.transactionHash,
      // The submission port models the absence of a memo as an omitted field,
      // so a `null` declared term is dropped rather than persisted as a null.
      ...(verified.value.memo === null ? {} : { memo: verified.value.memo }),
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
        distribution: toRevenueShareDistributionSnapshot(submitted.value.record, deps.explorerBaseUrl),
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
    explorerUrl: transactionExplorerUrl(explorerBaseUrl, record.transactionHash),
    failureReason: record.failureReason ?? null,
    lastCorrelationId: record.lastCorrelationId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  });
}

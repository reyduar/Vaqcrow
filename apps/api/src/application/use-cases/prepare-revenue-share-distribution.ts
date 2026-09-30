import type {
  CorrelationId,
  PrepareRevenueShareDistributionCommand,
  PreparedRevenueShareDistribution,
  RevenueShareDistributionId,
  RevenueShareDistributionTerms
} from "@vaqcrow/contracts";
import type { LedgerPort } from "../ports/ledger-port.js";
import type { RevenueShareDistributionRepositoryPort } from "../ports/revenue-share-distribution-repository-port.js";
import type {
  DeriveRevenueShareDistributionErrorCode,
  DeriveRevenueShareDistributionResult
} from "./derive-revenue-share-distribution.js";
import type { RevenueShareDistributionXdrPort } from "../ports/revenue-share-distribution-xdr-port.js";

/**
 * Derives a revenue-share distribution from the case, builds its unsigned
 * envelope and returns it with the terms it was built from. The recipients and
 * amounts are derived by the server (`deriveRevenueShareDistribution`, T5a) and
 * never supplied by the caller. It persists nothing (`D2`), for the same
 * reason `prepareFundingIntent` does not: a distribution only becomes evidence
 * once a signed transaction exists, so there is no pre-submission row to write
 * and no pre-submission state to invent.
 *
 * The account sequence is read from the ledger, never supplied by the caller:
 * a stale sequence produces an envelope the network rejects, and the caller has
 * no way to know the current one. An unfunded source account is an expected
 * Testnet state, so it is reported as `account_not_found` rather than retried
 * or treated as an outage.
 *
 * The declared `network` label is carried through for humans; the passphrase is
 * what the signature commits to, and both come from validated configuration,
 * never from the request.
 *
 * The distribution's lifetime is set here, explicitly: the API owns how long an
 * instruction to move money stays signable, so it does not delegate that to an
 * adapter default.
 */

/** Long enough for a wallet prompt, short enough that a leaked envelope dies. */
const REVENUE_SHARE_DISTRIBUTION_VALIDITY_SECONDS = 15 * 60;

export interface PrepareRevenueShareDistributionDeps {
  readonly ledger: LedgerPort;
  readonly xdr: RevenueShareDistributionXdrPort;
  /** Read only to refuse a second distribution of the same campaign and period. */
  readonly repository: Pick<RevenueShareDistributionRepositoryPort, "findActiveByCampaignPeriod">;
  readonly network: { readonly network: string; readonly networkPassphrase: string };
  readonly generateDistributionId: () => RevenueShareDistributionId;
  /**
   * The derivation, injected as a function so this use case depends on its
   * result and not on the ports it reads. The composition root binds it to
   * `deriveRevenueShareDistribution`.
   */
  readonly derive: (input: {
    readonly applicationId: PrepareRevenueShareDistributionCommand["applicationId"];
    readonly campaignId: string;
    readonly sourceAccountId: string;
    readonly correlationId: CorrelationId;
  }) => Promise<DeriveRevenueShareDistributionResult>;
}

export type PrepareRevenueShareDistributionError =
  | { readonly code: "account_not_found" | "invalid_input" | "unavailable" | "already_distributed" }
  | {
      readonly code: "derivation_failed";
      /** The closed derivation vocabulary: safe to return, names no internal detail. */
      readonly reason: Exclude<DeriveRevenueShareDistributionErrorCode, "unavailable">;
    };

export type PrepareRevenueShareDistributionResult =
  | { readonly ok: true; readonly value: PreparedRevenueShareDistribution }
  | { readonly ok: false; readonly error: PrepareRevenueShareDistributionError };

export async function prepareRevenueShareDistribution(
  deps: PrepareRevenueShareDistributionDeps,
  input: {
    readonly command: PrepareRevenueShareDistributionCommand;
    readonly correlationId: CorrelationId;
  }
): Promise<PrepareRevenueShareDistributionResult> {
  const command = input.command;

  const derived = await deps.derive({
    applicationId: command.applicationId,
    campaignId: command.campaignId,
    sourceAccountId: command.sourceAccountId,
    correlationId: input.correlationId
  });

  if (!derived.ok) {
    return derived.error.code === "unavailable"
      ? { ok: false, error: { code: "unavailable" } }
      : { ok: false, error: { code: "derivation_failed", reason: derived.error.code } };
  }

  // Refuse early: a campaign's period is distributed once. The unique index is
  // the authority under a race; this read only spares the signer a doomed prompt.
  const existing = await deps.repository.findActiveByCampaignPeriod({
    campaignId: command.campaignId,
    period: derived.value.derivation.period
  });

  if (existing.ok) return { ok: false, error: { code: "already_distributed" } };
  if (existing.error.code !== "not_found") return { ok: false, error: { code: "unavailable" } };

  const account = await deps.ledger.getAccount(command.sourceAccountId);

  if (!account.ok) {
    return account.error.code === "not_found"
      ? { ok: false, error: { code: "account_not_found" } }
      : { ok: false, error: { code: "unavailable" } };
  }

  // The API owns the envelope's lifetime. The terms it hands the port carry the
  // expiry those same bounds derive to, so a client that signs the returned
  // envelope commits to exactly the expiry the prepared shape echoes back.
  const maxTimeUnixSeconds = nowSeconds() + REVENUE_SHARE_DISTRIBUTION_VALIDITY_SECONDS;

  const terms: RevenueShareDistributionTerms = {
    network: deps.network.network,
    networkPassphrase: deps.network.networkPassphrase,
    sourceAccountId: command.sourceAccountId,
    sourceSequence: account.value.sequence,
    memo: command.memo,
    expiresAt: new Date(maxTimeUnixSeconds * 1000).toISOString(),
    recipients: [...derived.value.recipients]
  };

  const built = deps.xdr.build({ terms, maxTimeUnixSeconds });

  if (!built.ok) {
    // `invalid_input` is the port saying the caller handed it something it
    // cannot encode. Anything else on the build path means the encoding layer
    // could not run at all.
    return built.error.code === "invalid_input"
      ? { ok: false, error: { code: "invalid_input" } }
      : { ok: false, error: { code: "unavailable" } };
  }

  return {
    ok: true,
    value: {
      distributionId: deps.generateDistributionId(),
      xdr: built.value.xdr,
      network: deps.network.network,
      networkPassphrase: built.value.networkPassphrase,
      sourceAccountId: built.value.sourceAccountId,
      // The *effective* sequence: the builder increments the account sequence,
      // and that is what a later verification must compare the envelope against.
      sourceSequence: built.value.sourceSequence,
      // The port hands back a readonly list; the contract's shape is a mutable
      // array, so it is copied into one rather than narrowing the contract.
      recipients: [...built.value.recipients],
      memo: built.value.memo,
      expiresAt: built.value.expiresAt,
      // The case the distribution was derived for, echoed so the client can
      // hand it back at submit, where it is re-derived. Neither id is a term:
      // the envelope does not carry them.
      applicationId: command.applicationId,
      campaignId: command.campaignId,
      derivation: derived.value.derivation
    }
  };
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

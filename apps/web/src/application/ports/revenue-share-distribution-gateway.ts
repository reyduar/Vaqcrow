import type {
  PreparedRevenueShareDistribution,
  RevenueShareDistributionId,
  RevenueShareDistributionSnapshot,
  RevenueShareDistributionTerms
} from "@vaqcrow/contracts";

/**
 * Successful submit answer.
 *
 * `applied: false` is an exact replay of an already persisted distribution, not
 * a failure: the API answers `202` for a first submission and `200` for a
 * replay, and both are successes. Carried the same way `SubmittedFundingIntent`
 * carries it, so the UI can say which one happened instead of collapsing them.
 */
export interface SubmittedRevenueShareDistribution {
  readonly applied: boolean;
  readonly distribution: RevenueShareDistributionSnapshot;
}

/**
 * The closed vocabulary the API gives for a refused derivation
 * (`{ code: "derivation_failed", reason }`). A reason outside it is never
 * guessed at: the gateway reports `unknown` instead.
 */
export const DERIVATION_FAILURE_REASONS = [
  "campaign_not_found",
  "application_not_found",
  "application_mismatch",
  "source_not_sme",
  "campaign_not_settled",
  "decision_not_approved",
  "no_eligible_period",
  "invalid_sales_data",
  "no_contributors",
  "contributions_incomplete",
  "obligation_rounds_to_zero"
] as const;

export type DerivationFailureReason = (typeof DERIVATION_FAILURE_REASONS)[number];

/**
 * Why a distribution call failed, as a coarse kind the UI can act on.
 *
 * Deliberately the same vocabulary `FundingSubmitErrorKind` uses for its
 * backend failures, so the two flows describe the same HTTP outcomes the same
 * way. Wallet failures are not here: this port never touches a wallet — signing
 * belongs to the workspace, which classifies `WalletError` itself.
 */
export type RevenueShareDistributionErrorKind =
  | "derivation_failed"
  | "derivation_mismatch"
  | "already_distributed"
  | "validation"
  | "account_not_found"
  | "not_found"
  | "xdr_rejected"
  | "idempotency_conflict"
  | "conflict"
  | "unavailable"
  | "network"
  | "unknown";

/**
 * Sanitized failure. It carries only a coarse kind — never the backend's own
 * message, body or headers — so nothing internal can reach the presentation
 * layer. The sentence a person reads is authored by the caller, not here.
 */
export type RevenueShareDistributionGatewayError =
  | { readonly kind: "derivation_failed"; readonly reason: DerivationFailureReason }
  | { readonly kind: Exclude<RevenueShareDistributionErrorKind, "derivation_failed"> };

/**
 * A gateway answer: either contract-validated data or a sanitized failure.
 *
 * The union is total on purpose. `HttpClientError` failures and a response that
 * drifted from the contracts both become an `ok: false` value rather than a
 * thrown error, so a caller cannot forget to catch and accidentally render a
 * failure as success.
 */
export type RevenueShareDistributionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RevenueShareDistributionGatewayError };

/**
 * What the caller declares before the API derives and builds the multi-payment
 * envelope: the source, the case and an optional memo. There are no recipients
 * or amounts: the API derives them from the settled campaign and the SME's
 * sales, so the web cannot declare a split the case does not support.
 *
 * Plain data: the ids are ordinary strings, not branded contract types, because
 * `application/` and `presentation/` hold no runtime validation logic. The
 * adapter is what parses the answer through the `@vaqcrow/contracts` schemas.
 */
export interface PrepareRevenueShareDistributionRequest {
  readonly sourceAccountId: string;
  readonly applicationId: string;
  readonly campaignId: string;
  readonly memo: string | null;
}

/**
 * The submit command: the declared terms the person was shown, plus the id the
 * prepared response named. `applicationId` is a sibling of `terms`, exactly as
 * the wire contract has it.
 */
export interface SubmitRevenueShareDistributionRequest {
  readonly distributionId: RevenueShareDistributionId;
  readonly signedXdr: string;
  readonly terms: RevenueShareDistributionTerms;
  /** The case the terms were derived for; the API re-derives and refuses terms that differ. */
  readonly applicationId: string;
  readonly campaignId: string;
}

/**
 * Port for the revenue-share distribution backend.
 *
 * The port is SDK-free and React-free: the unsigned XDR and the network
 * passphrase are opaque strings the web passes through untouched, so the web
 * never builds, decodes or verifies a transaction, and never owns a network
 * identity of its own (`D1`). The API is the only authority for the
 * calculation and the built envelope; the web performs no arithmetic beyond
 * display formatting.
 */
export interface RevenueShareDistributionGateway {
  /** Derives the distribution and builds the unsigned envelope. Stateless: nothing is persisted server-side. */
  prepare(
    command: PrepareRevenueShareDistributionRequest
  ): Promise<RevenueShareDistributionResult<PreparedRevenueShareDistribution>>;
  /** Verifies and persists the signed envelope. `applied: false` is a replay. */
  submit(
    command: SubmitRevenueShareDistributionRequest
  ): Promise<RevenueShareDistributionResult<SubmittedRevenueShareDistribution>>;
  /** Reads the persisted distribution back. */
  getStatus(
    distributionId: RevenueShareDistributionId
  ): Promise<RevenueShareDistributionResult<RevenueShareDistributionSnapshot>>;
}

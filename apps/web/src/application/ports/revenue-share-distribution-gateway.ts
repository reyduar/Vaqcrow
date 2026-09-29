import type {
  DistributionRecipient,
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
 * Why a distribution call failed, as a coarse kind the UI can act on.
 *
 * Deliberately the same vocabulary `FundingSubmitErrorKind` uses for its
 * backend failures, so the two flows describe the same HTTP outcomes the same
 * way. Wallet failures are not here: this port never touches a wallet — signing
 * belongs to the workspace, which classifies `WalletError` itself.
 */
export type RevenueShareDistributionErrorKind =
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
export interface RevenueShareDistributionGatewayError {
  readonly kind: RevenueShareDistributionErrorKind;
}

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
 * What the caller declares before the API builds and simulates the
 * multi-payment envelope.
 *
 * Plain data: `sourceAccountId` and `applicationId` are ordinary strings, not
 * branded contract types, because `application/` and `presentation/` hold no
 * runtime validation logic. The adapter is what parses this through the
 * `@vaqcrow/contracts` schemas on the way out.
 */
export interface PrepareRevenueShareDistributionRequest {
  readonly sourceAccountId: string;
  readonly recipients: readonly DistributionRecipient[];
  readonly memo: string | null;
  readonly applicationId: string | null;
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
  readonly applicationId: string | null;
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
  /** Builds the unsigned envelope. Stateless: nothing is persisted server-side. */
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

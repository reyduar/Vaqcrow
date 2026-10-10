/**
 * The investor's portfolio read model (#426, WU1).
 *
 * Vendor-free: this port lives in `application/` and imports no Fastify,
 * Supabase or Stellar SDK. One row per campaign the investor contributed to,
 * and one row per distribution recipient the investor is, both read through
 * service_role-only, `security_invoker` views. The caller always supplies the
 * `investorAccountId` it resolved from the verified principal, so the adapter
 * can only ever read that account's own rows.
 *
 * The records carry only facts persisted from a confirmed ledger read. The
 * application layer does every unit conversion (stroops -> canonical XLM,
 * stroops -> ARS through the campaign's own snapshot), so no FX or formatting
 * policy leaks into the adapter.
 */

/**
 * A copy of the rate the campaign was validated against when its vault was
 * deployed (#410/T3a). Optional because a campaign opened before the snapshot
 * existed carries none; `raisedArs` is then `null` (an honest "sin dato"),
 * never zero.
 */
export interface PortfolioRateSnapshot {
  /** ARS per USD, scaled by `RATE_SCALE`. */
  readonly usdToArs: bigint;
  /** Native stroops per USD. */
  readonly stroopsPerUsd: bigint;
}

/** The campaign mirror's own lifecycle vocabulary (`campaign.state`). */
export type PortfolioCampaignState = "open" | "settled" | "refundable";

export interface PortfolioPositionRecord {
  readonly campaignId: string;
  readonly name: string;
  readonly sector: string;
  readonly city: string;
  /** The investor's own confirmed contribution, in stroops. */
  readonly contributionStroops: bigint;
  /** The PyME's goal in whole ARS, from `businesses.goal_ars`. */
  readonly goalArs: bigint;
  /** The persisted mirror of the vault's running total (never a live chain read). */
  readonly totalStroops: bigint;
  readonly goalStroops: bigint;
  readonly state: PortfolioCampaignState;
  /** The campaign's ISO deadline, from `campaign.deadline`. */
  readonly closeDate: string;
  /** The persisted vault contract id (`campaign.contract_address`). */
  readonly vaultAddress: string;
  /**
   * Whether the campaign's PyME has at least one image document. The use case
   * turns this into the API-relative `imageUrl`; the private object path is
   * never part of the record.
   */
  readonly hasImage: boolean;
  readonly rateSnapshot?: PortfolioRateSnapshot;
}

export interface PortfolioDistributionRecord {
  readonly distributionId: string;
  /** `null` for a distribution recorded before the campaign link existed. */
  readonly campaignId: string | null;
  /** `null` when the campaign (and its company) cannot be resolved. */
  readonly campaignName: string | null;
  /** The settled `YYYY-MM`; `null` for a legacy distribution. */
  readonly period: string | null;
  /** This recipient's allocation, in stroops. */
  readonly amountStroops: bigint;
  /** The persisted distribution's own state machine. */
  readonly state: "submitted" | "confirmed" | "failed";
  /** The distribution's Testnet hash (#438/WU3); the persisted column is `not null`. */
  readonly transactionHash: string;
}

/**
 * One **observed** contribute transaction of the investor (#438/WU3), read from
 * `investor_contribution_transaction` (`observed_at IS NOT NULL` only). A
 * contribution sent before the hashes were persisted has no record.
 */
export interface PortfolioContributionTransactionRecord {
  readonly transactionHash: string;
  readonly campaignId: string;
  /** This transaction's own amount, in stroops. */
  readonly amountStroops: bigint;
  /** When the chain read confirmed it, as an ISO datetime. */
  readonly observedAt: string;
}

export type PortfolioRepositoryError = { readonly code: "unavailable" };

export type PortfolioRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PortfolioRepositoryError };

export interface PortfolioRepositoryPort {
  /** Every campaign the investor contributed to, for a deployed campaign. */
  listPositions(
    investorAccountId: string
  ): Promise<PortfolioRepositoryResult<readonly PortfolioPositionRecord[]>>;

  /** Every distribution recipient row addressed to the investor. */
  listDistributions(
    investorAccountId: string
  ): Promise<PortfolioRepositoryResult<readonly PortfolioDistributionRecord[]>>;

  /** Every observed contribute transaction the investor's account sent (#438/WU3). */
  listContributionTransactions(
    investorAccountId: string
  ): Promise<PortfolioRepositoryResult<readonly PortfolioContributionTransactionRecord[]>>;
}

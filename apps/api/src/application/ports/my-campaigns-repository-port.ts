/**
 * The PyME dashboard read model (#434, WU1).
 *
 * Vendor-free: this port lives in `application/` and imports no Fastify,
 * Supabase or Stellar SDK. It reads the caller's own campaigns — current and
 * historic — through service_role-only, `security_invoker` views, keyed by the
 * `ownerUserId` the caller resolved from the verified principal. The adapter
 * can only ever filter by that owner, so it can never read another PyME's rows.
 *
 * The records carry only facts persisted from a confirmed ledger read. The
 * application layer does every unit conversion (stroops -> canonical XLM,
 * stroops -> ARS through the campaign's own snapshot), so no FX or formatting
 * policy leaks into the adapter.
 */

/** A copy of the rate the campaign was validated against when its vault was deployed (#410/T3a). */
export interface MyCampaignRateSnapshot {
  /** ARS per USD, scaled by `RATE_SCALE`. */
  readonly usdToArs: bigint;
  /** Native stroops per USD. */
  readonly stroopsPerUsd: bigint;
}

/** The campaign mirror's own lifecycle vocabulary (`campaign.state`). */
export type MyCampaignRepositoryState = "open" | "settled" | "refundable";

/** One campaign the PyME owns, with its dashboard fields. */
export interface MyCampaignRecord {
  readonly campaignId: string;
  readonly name: string;
  readonly sector: string;
  readonly city: string;
  /** The PyME's goal in whole ARS, from `businesses.goal_ars`. */
  readonly goalArs: bigint;
  /** The persisted mirror of the vault's running total (never a live chain read). */
  readonly totalStroops: bigint;
  readonly goalStroops: bigint;
  readonly state: MyCampaignRepositoryState;
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
  /** The number of distinct contributors mirrored for the campaign. */
  readonly contributorsCount: number;
  /**
   * The campaign's rate snapshot (#410/T3a). Optional because a campaign opened
   * before the snapshot existed carries none; `raisedArs` is then `null` (an
   * honest "sin dato"), never zero.
   */
  readonly rateSnapshot?: MyCampaignRateSnapshot;
}

export type MyCampaignDistributionState = "submitted" | "confirmed" | "failed";

/** One distribution the campaign paid out, with its recipients aggregated. */
export interface MyCampaignDistributionRecord {
  readonly campaignId: string;
  readonly distributionId: string;
  /** The settled `YYYY-MM`; `null` for a legacy distribution. */
  readonly period: string | null;
  /** The distribution's total allocation, in stroops (always > 0). */
  readonly amountStroops: bigint;
  readonly state: MyCampaignDistributionState;
}

export type MyCampaignSalesStatus = "reported" | "missing" | "anomalous";

/** One declared-sales month of the campaign's PyME. */
export interface MyCampaignSalesRecord {
  readonly campaignId: string;
  readonly period: string;
  /** `null` exactly for a `missing` month — an absence, never a zero. */
  readonly salesArs: bigint | null;
  readonly status: MyCampaignSalesStatus;
}

export type MyCampaignsRepositoryError = { readonly code: "unavailable" };

export type MyCampaignsRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MyCampaignsRepositoryError };

export interface MyCampaignsRepositoryPort {
  /** Every campaign owned by the PyME, newest first. */
  listCampaigns(ownerUserId: string): Promise<MyCampaignsRepositoryResult<readonly MyCampaignRecord[]>>;

  /** Every distribution of the PyME's campaigns. */
  listDistributions(
    ownerUserId: string
  ): Promise<MyCampaignsRepositoryResult<readonly MyCampaignDistributionRecord[]>>;

  /** Every declared-sales month of the PyME's campaigns' companies. */
  listSales(ownerUserId: string): Promise<MyCampaignsRepositoryResult<readonly MyCampaignSalesRecord[]>>;
}

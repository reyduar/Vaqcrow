/**
 * The public marketplace read model (#414/WU1).
 *
 * One record per **published** campaign: the vault deployment is `confirmed`
 * and the campaign is `open`. The record carries only public facts; the
 * application layer converts the mirrored stroop total into ARS through the
 * campaign's own rate snapshot, so nothing about FX policy leaks into the
 * adapter.
 */
import type { RiskBand } from "@vaqcrow/contracts";

/**
 * A copy of the rate the campaign was validated against when its vault was
 * deployed (#410/T3a). Optional because a campaign opened before the snapshot
 * existed carries none; `raisedArs` is then `null` (an honest "sin dato"),
 * never zero.
 */
export interface MarketplaceCampaignRateSnapshot {
  readonly version: number;
  /** ARS per USD, scaled by `RATE_SCALE`. */
  readonly usdToArs: bigint;
  /** Native stroops per USD. */
  readonly stroopsPerUsd: bigint;
}

export interface MarketplaceCampaignRecord {
  readonly campaignId: string;
  readonly name: string;
  readonly sector: string;
  readonly city: string;
  /** The PyME's goal in whole ARS, from `businesses.goal_ars`. */
  readonly goalArs: bigint;
  /** The persisted mirror of the vault's running total (never a live chain read). */
  readonly totalStroops: bigint;
  readonly goalStroops: bigint;
  readonly revenueShare: number;
  readonly riskBand: RiskBand | null;
  readonly riskConfidence: number | null;
  /** The campaign's ISO deadline, from `campaign.deadline`. */
  readonly closeDate: string;
  readonly rateSnapshot?: MarketplaceCampaignRateSnapshot;
}

export type MarketplaceCampaignRepositoryError = { readonly code: "unavailable" };

export type MarketplaceCampaignRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MarketplaceCampaignRepositoryError };

export interface MarketplaceCampaignRepositoryPort {
  /** Every published campaign, ordered by soonest deadline first. */
  listPublished(): Promise<MarketplaceCampaignRepositoryResult<readonly MarketplaceCampaignRecord[]>>;
}

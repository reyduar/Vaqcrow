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
  /**
   * Whether the campaign's PyME has at least one image document. The listing
   * turns this into the API-relative `imageUrl`; the object path itself is
   * never part of the card.
   */
  readonly hasImage: boolean;
  readonly rateSnapshot?: MarketplaceCampaignRateSnapshot;
}

/**
 * The first image document of a published campaign's PyME (#414/WU3): the
 * server-owned storage object path and its stored content type. It is resolved
 * only for the API to read the bytes; neither field is ever returned to a
 * caller.
 */
export interface MarketplaceCampaignImageRecord {
  readonly objectPath: string;
  readonly contentType: string;
}

export type MarketplaceCampaignRepositoryError = { readonly code: "unavailable" };

export type MarketplaceCampaignRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MarketplaceCampaignRepositoryError };

export interface MarketplaceCampaignRepositoryPort {
  /** Every published campaign, ordered by soonest deadline first. */
  listPublished(): Promise<MarketplaceCampaignRepositoryResult<readonly MarketplaceCampaignRecord[]>>;

  /**
   * The first image descriptor of a **published** campaign (confirmed vault on
   * an `open` campaign), or `undefined` when the campaign is not published or
   * carries no image. The published filter lives in the view, so an unpublished
   * campaign resolves to `undefined` here exactly as it is absent from
   * `listPublished`.
   */
  findPublishedImage(
    campaignId: string
  ): Promise<MarketplaceCampaignRepositoryResult<MarketplaceCampaignImageRecord | undefined>>;
}

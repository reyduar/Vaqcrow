/**
 * The account-gated campaign detail read model (#422/WU1).
 *
 * One record per **published** campaign: the vault deployment is `confirmed`
 * and the campaign is `open` — the same definition as the #414 marketplace
 * listing. The record carries the raw persisted facts (integer stroop totals,
 * the campaign's FX rate snapshot, the optional AI assessment and the latest
 * human decision); the application layer does every unit conversion and derives
 * the lifecycle `status`, so no repository knows about the wire contract.
 *
 * Plain data only: this port lives in `application/` and imports no Fastify,
 * Supabase or Stellar SDK.
 */
import type { RiskBand } from "@vaqcrow/contracts";

/** The persisted campaign mirror's own state (never the chain's vocabulary). */
export type CampaignDetailState = "open" | "settled" | "refundable";

/**
 * A copy of the rate the campaign was validated against when its vault was
 * deployed. Optional because a campaign opened before the snapshot existed
 * carries none; `raisedArs` is then `null` (an honest "sin dato"), never zero.
 */
export interface CampaignDetailRateSnapshot {
  readonly version: number;
  /** ARS per USD, scaled by `RATE_SCALE`. */
  readonly usdToArs: bigint;
  /** Native stroops per USD. */
  readonly stroopsPerUsd: bigint;
}

/** The persisted AI assessment, already reduced to public fields. */
export interface CampaignDetailAssessmentRecord {
  readonly riskBand: RiskBand;
  readonly confidence: number;
  /** The assessment's claim strings; the evidence references never leave the DB. */
  readonly reasons: readonly string[];
  readonly model: string;
  readonly generatedAt: string;
}

/** The latest recorded human decision, reduced to public fields. */
export interface CampaignDetailDecisionRecord {
  readonly actor: string;
  readonly reason: string;
  readonly approvedLimitArs: bigint | null;
  readonly recordedAt: string;
}

/**
 * One persisted monthly sales period (#422/WU2b), read from
 * `business_sales_period`. `salesArs` is `null` for a `missing` month — never a
 * `0`; `source` is the datum's provenance. The array arrives in `YYYY-MM`
 * order from the view.
 */
export interface CampaignDetailSalesMonthRecord {
  readonly period: string;
  readonly salesArs: bigint | null;
  readonly status: "reported" | "missing" | "anomalous";
  readonly source: string;
}

/**
 * The business's persisted sales evidence. The application layer derives the
 * average and the declared count from `months`, so the repository stays a pure
 * row mapper. Optional on the record only so a hand-built test fixture can omit
 * it; a present-but-empty array means the same as absent — no persisted
 * periods.
 */
export interface CampaignDetailSalesEvidenceRecord {
  readonly months: readonly CampaignDetailSalesMonthRecord[];
}

export interface CampaignDetailRecord {
  readonly campaignId: string;
  readonly name: string;
  readonly sector: string;
  readonly city: string;
  /** `businesses.description` ("Sobre la PyME"). */
  readonly description: string;
  /** `businesses.created_at` ("Desde"). */
  readonly foundedAt: string;
  /** The PyME's goal in whole ARS, from `businesses.goal_ars`. */
  readonly goalArs: bigint;
  /** The persisted mirror of the vault's running total (never a live chain read). */
  readonly totalStroops: bigint;
  readonly goalStroops: bigint;
  readonly revenueShare: number;
  /** The campaign's ISO deadline, from `campaign.deadline`. */
  readonly deadline: string;
  /** The persisted campaign mirror state (`open` for every published row). */
  readonly state: CampaignDetailState;
  /** Whether the PyME has at least one eligible photo; the object path never travels. */
  readonly hasImage: boolean;
  /** The persisted vault contract id (`campaign.contract_address`), or `null`. */
  readonly vaultAddress: string | null;
  readonly backers: number;
  readonly rateSnapshot?: CampaignDetailRateSnapshot;
  readonly assessment: CampaignDetailAssessmentRecord | null;
  readonly decision: CampaignDetailDecisionRecord | null;
  /**
   * The business's persisted sales periods, or `undefined`/empty when it has
   * none. Optional so an existing hand-built fixture that predates the sales
   * evidence stays valid; the use case treats absence as the honest `null`.
   */
  readonly salesEvidence?: CampaignDetailSalesEvidenceRecord;
}

export type CampaignDetailRepositoryError = { readonly code: "unavailable" };

export type CampaignDetailRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CampaignDetailRepositoryError };

export interface CampaignDetailRepositoryPort {
  /**
   * The detail of a **published** campaign, or `undefined` when the campaign is
   * unknown or not published. The published filter lives in the view, so an
   * unpublished campaign resolves to `undefined` exactly as it is absent from
   * the marketplace listing.
   */
  findPublished(campaignId: string): Promise<CampaignDetailRepositoryResult<CampaignDetailRecord | undefined>>;
}

import { marketplaceCampaignSchema } from "@vaqcrow/contracts";
import type { MarketplaceCampaign, MarketplaceCampaignList } from "@vaqcrow/contracts";
import type {
  MarketplaceCampaignRateSnapshot,
  MarketplaceCampaignRecord,
  MarketplaceCampaignRepositoryPort
} from "../ports/marketplace-campaign-repository-port.js";
import { RATE_SCALE } from "./campaign-guardrails.js";

/**
 * The public marketplace listing (#414/WU1).
 *
 * Reads every published campaign and shapes it into the portable
 * `marketplaceCampaignListSchema`. All money math is integer-only, mirroring
 * `validateCampaignGuardrails`: `raisedArs` divides the mirrored stroop total
 * through the campaign's own rate snapshot,
 * `total_stroops * usd_to_ars / (stroops_per_usd * RATE_SCALE)`, and
 * `fundedPercentBps` is `total_stroops * 10000 / goal_stroops` clamped to
 * `0..10000`. A missing snapshot yields `raisedArs: null`, never a fabricated
 * zero.
 *
 * A repository failure and a malformed record both map to `unavailable`,
 * never a half-built or silently shortened list.
 */

export interface ListMarketplaceCampaignsDependencies {
  readonly repository: Pick<MarketplaceCampaignRepositoryPort, "listPublished">;
}

export type ListMarketplaceCampaignsResult =
  | { readonly ok: true; readonly value: MarketplaceCampaignList }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function listMarketplaceCampaigns(
  dependencies: ListMarketplaceCampaignsDependencies
): Promise<ListMarketplaceCampaignsResult> {
  const listed = await dependencies.repository.listPublished();
  if (!listed.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  try {
    return { ok: true, value: { items: listed.value.map(toMarketplaceCampaign) } };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}

/** Percent of the goal funded, in basis points, clamped to `0..10000`. */
export function toFundedPercentBps(totalStroops: bigint, goalStroops: bigint): number {
  if (goalStroops <= 0n) return 0;
  const bps = (totalStroops * 10_000n) / goalStroops;
  if (bps <= 0n) return 0;
  return Number(bps > 10_000n ? 10_000n : bps);
}

/**
 * Converts the mirrored stroop total to whole ARS through the campaign's rate
 * snapshot. `null` when there is no snapshot (or an unusable one), because a
 * missing conversion is "sin dato", never zero.
 */
export function toRaisedArs(
  totalStroops: bigint,
  snapshot: MarketplaceCampaignRateSnapshot | undefined
): number | null {
  if (snapshot === undefined || snapshot.usdToArs <= 0n || snapshot.stroopsPerUsd <= 0n) return null;
  const ars = (totalStroops * snapshot.usdToArs) / (snapshot.stroopsPerUsd * RATE_SCALE);
  return Number(ars < 0n ? 0n : ars);
}

function toMarketplaceCampaign(record: MarketplaceCampaignRecord): MarketplaceCampaign {
  return marketplaceCampaignSchema.parse({
    campaignId: record.campaignId,
    name: record.name,
    sector: record.sector,
    city: record.city,
    goalArs: Number(record.goalArs),
    raisedArs: toRaisedArs(record.totalStroops, record.rateSnapshot),
    fundedPercentBps: toFundedPercentBps(record.totalStroops, record.goalStroops),
    revenueShare: record.revenueShare,
    riskBand: record.riskBand,
    riskConfidence: record.riskConfidence,
    closeDate: record.closeDate,
    // Reserved for WU3 (the real PyME photo served by the API).
    imageUrl: null
  });
}

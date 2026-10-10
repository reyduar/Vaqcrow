import { myCampaignDistributionSchema, myCampaignsSchema } from "@vaqcrow/contracts";
import type { MyCampaign, MyCampaigns } from "@vaqcrow/contracts";
import { contractExplorerUrl, transactionExplorerUrl } from "../explorer-url.js";
import type {
  MyCampaignDistributionRecord,
  MyCampaignRateSnapshot,
  MyCampaignRecord,
  MyCampaignSalesRecord,
  MyCampaignsRepositoryPort
} from "../ports/my-campaigns-repository-port.js";

/**
 * The PyME dashboard read model (#434, WU1).
 *
 * The caller is always the verified principal: the use case scopes every read
 * to `input.userId` (the owner), so a caller can only ever see its own
 * campaigns — current and historic. There is no caller-supplied identity.
 *
 * All money math is integer-only: ARS stays `bigint` until the wire number and
 * XLM is the canonical seven-decimal string (`n / 10^7`). The distribution's
 * ARS figure mirrors `validateCampaignGuardrails` /
 * `toRaisedArs` (`stroops * usd_to_ars / (stroops_per_usd * RATE_SCALE)`): a
 * campaign with no rate snapshot yields `null` for both `raisedArs` and every
 * distribution's `amountArs` — "sin dato", never a fabricated zero. A `missing`
 * sales month is `null` for the same reason.
 */

/** ARS per USD scale, matching `campaign-guardrails.ts`. Duplicated because use cases never import each other. */
const RATE_SCALE = 1_000_000n;
const STROOPS_PER_XLM = 10_000_000n;

export interface GetMyCampaignsDependencies {
  readonly myCampaigns: Pick<MyCampaignsRepositoryPort, "listCampaigns" | "listDistributions" | "listSales">;
  /** Injected for deterministic state derivation; `index.ts` passes `() => new Date()`. */
  readonly now: () => Date;
  /**
   * `StellarConfig.explorerUrl` (#438/WU3); `undefined` on the `local` network,
   * which turns every explorer link into `null`. The hashes are still returned.
   */
  readonly explorerBaseUrl: string | undefined;
}

export type GetMyCampaignsResult =
  | { readonly ok: true; readonly value: MyCampaigns }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function getMyCampaigns(
  dependencies: GetMyCampaignsDependencies,
  input: { readonly userId: string }
): Promise<GetMyCampaignsResult> {
  const [campaigns, distributions, sales] = await Promise.all([
    dependencies.myCampaigns.listCampaigns(input.userId),
    dependencies.myCampaigns.listDistributions(input.userId),
    dependencies.myCampaigns.listSales(input.userId)
  ]);

  if (!campaigns.ok || !distributions.ok || !sales.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  try {
    return {
      ok: true,
      value: myCampaignsSchema.parse(
        toDashboard(campaigns.value, distributions.value, sales.value, dependencies.explorerBaseUrl, dependencies.now())
      )
    };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}

/** Canonical XLM: exactly seven decimals, `bigint` math, never a float. */
function toXlm(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_XLM;
  const fraction = (stroops % STROOPS_PER_XLM).toString().padStart(7, "0");
  return `${whole}.${fraction}`;
}

/** Percent of the goal funded, in basis points, clamped to `0..10000`. */
function toFundedPercentBps(totalStroops: bigint, goalStroops: bigint): number {
  if (goalStroops <= 0n) return 0;
  const bps = (totalStroops * 10_000n) / goalStroops;
  if (bps <= 0n) return 0;
  return Number(bps > 10_000n ? 10_000n : bps);
}

/**
 * Converts a stroop amount to whole ARS through the campaign's rate snapshot.
 * `null` when there is no snapshot (or it is degenerate), because a missing
 * conversion is "sin dato", never zero.
 */
function toArs(stroops: bigint, snapshot: MyCampaignRateSnapshot | undefined): number | null {
  if (snapshot === undefined || snapshot.usdToArs <= 0n || snapshot.stroopsPerUsd <= 0n) return null;
  const ars = (stroops * snapshot.usdToArs) / (snapshot.stroopsPerUsd * RATE_SCALE);
  return Number(ars < 0n ? 0n : ars);
}

/** Derives the campaign's lifecycle from the persisted mirror, never the request. */
function deriveState(record: MyCampaignRecord, now: Date): MyCampaign["state"] {
  if (record.state === "settled") return "settled";
  if (record.state === "refundable") return "refunding";
  if (record.totalStroops >= record.goalStroops) return "settled";
  if (now.getTime() >= Date.parse(record.closeDate)) return "refunding";
  return "funding";
}

function toDistribution(
  record: MyCampaignDistributionRecord,
  snapshot: MyCampaignRateSnapshot | undefined,
  explorerBaseUrl: string | undefined
): MyCampaign["distributions"][number] {
  return myCampaignDistributionSchema.parse({
    distributionId: record.distributionId,
    period: record.period,
    amountArs: toArs(record.amountStroops, snapshot),
    amountXlm: toXlm(record.amountStroops),
    state: record.state,
    transactionHash: record.transactionHash,
    explorerUrl: explorerBaseUrl === undefined ? null : transactionExplorerUrl(explorerBaseUrl, record.transactionHash)
  });
}

function toCampaign(
  record: MyCampaignRecord,
  distributions: readonly MyCampaignDistributionRecord[],
  sales: readonly MyCampaignSalesRecord[],
  explorerBaseUrl: string | undefined,
  now: Date
): MyCampaign {
  return {
    campaignId: record.campaignId,
    name: record.name,
    sector: record.sector,
    city: record.city,
    imageUrl: record.hasImage ? `/marketplace/campaigns/${record.campaignId}/image` : null,
    vaultAddress: record.vaultAddress,
    vaultExplorerUrl: explorerBaseUrl === undefined ? null : contractExplorerUrl(explorerBaseUrl, record.vaultAddress),
    state: deriveState(record, now),
    goalArs: Number(record.goalArs),
    raisedArs: toArs(record.totalStroops, record.rateSnapshot),
    fundedPercentBps: toFundedPercentBps(record.totalStroops, record.goalStroops),
    deadline: record.closeDate,
    contributorsCount: record.contributorsCount,
    distributions: [...distributions]
      .sort(compareDistributions)
      .map((entry) => toDistribution(entry, record.rateSnapshot, explorerBaseUrl)),
    sales: [...sales]
      .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0))
      .map((entry) => ({
        period: entry.period,
        salesArs: entry.salesArs === null ? null : Number(entry.salesArs),
        status: entry.status
      }))
  };
}

/**
 * Deterministic distribution order: by settled period ascending (a legacy row
 * with no period sorts last), then by id, so the wire order never depends on
 * the adapter's row order.
 */
function compareDistributions(a: MyCampaignDistributionRecord, b: MyCampaignDistributionRecord): number {
  if (a.period === null && b.period !== null) return 1;
  if (a.period !== null && b.period === null) return -1;
  if (a.period !== null && b.period !== null && a.period !== b.period) return a.period < b.period ? -1 : 1;
  return a.distributionId < b.distributionId ? -1 : a.distributionId > b.distributionId ? 1 : 0;
}

/**
 * Shapes the three reads into the portable dashboard. Each campaign keeps only
 * the distributions and sales months that name it; the records arrive already
 * scoped to the owner. A record whose campaign is unknown is ignored rather
 * than invented.
 */
function toDashboard(
  campaigns: readonly MyCampaignRecord[],
  distributions: readonly MyCampaignDistributionRecord[],
  sales: readonly MyCampaignSalesRecord[],
  explorerBaseUrl: string | undefined,
  now: Date
): MyCampaigns {
  const distributionsByCampaign = new Map<string, MyCampaignDistributionRecord[]>();
  for (const distribution of distributions) {
    const bucket = distributionsByCampaign.get(distribution.campaignId) ?? [];
    bucket.push(distribution);
    distributionsByCampaign.set(distribution.campaignId, bucket);
  }

  const salesByCampaign = new Map<string, MyCampaignSalesRecord[]>();
  for (const month of sales) {
    const bucket = salesByCampaign.get(month.campaignId) ?? [];
    bucket.push(month);
    salesByCampaign.set(month.campaignId, bucket);
  }

  return {
    campaigns: campaigns.map((record) =>
      toCampaign(
        record,
        distributionsByCampaign.get(record.campaignId) ?? [],
        salesByCampaign.get(record.campaignId) ?? [],
        explorerBaseUrl,
        now
      )
    )
  };
}

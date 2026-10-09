import { portfolioDistributionSchema, portfolioSummarySchema } from "@vaqcrow/contracts";
import type { PortfolioDistribution, PortfolioPosition, PortfolioSummary } from "@vaqcrow/contracts";
import type {
  PortfolioDistributionRecord,
  PortfolioPositionRecord,
  PortfolioRepositoryPort
} from "../ports/portfolio-repository-port.js";
import type { WalletRepositoryPort } from "../ports/wallet-repository-port.js";

/**
 * The investor's portfolio read model (#426, WU1).
 *
 * The investor's Stellar account is resolved **server-side** from the verified
 * principal's stored profile key — `application/` only depends on the
 * vendor-free `WalletRepositoryPort`. A caller-supplied account is never read,
 * so a principal can only ever see its own positions and distributions. When
 * the principal has no stored key, the portfolio is honestly empty.
 *
 * All money math is integer-only: contributions and allocations stay `bigint`
 * until the final canonical XLM string (`n / 10^7` with exactly seven
 * decimals), and the ARS conversion mirrors `validateCampaignGuardrails`
 * (`total_stroops * usd_to_ars / (stroops_per_usd * RATE_SCALE)`). A missing
 * rate snapshot yields `raisedArs: null`, and no confirmed distribution yields
 * `totalDistributionsXlm: null` — "sin dato", never a fabricated zero.
 */

/** ARS per USD scale, matching `campaign-guardrails.ts`. Duplicated because use cases never import each other. */
const RATE_SCALE = 1_000_000n;
const STROOPS_PER_XLM = 10_000_000n;

export interface GetInvestorPortfolioDependencies {
  /** Resolves the verified principal's stored Stellar key (its profile column). */
  readonly wallets: Pick<WalletRepositoryPort, "readPublicKey">;
  readonly portfolio: Pick<PortfolioRepositoryPort, "listPositions" | "listDistributions">;
  /** Injected for deterministic status derivation; `index.ts` passes `() => new Date()`. */
  readonly now: () => Date;
}

export type GetInvestorPortfolioResult =
  | { readonly ok: true; readonly value: PortfolioSummary }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function getInvestorPortfolio(
  dependencies: GetInvestorPortfolioDependencies,
  input: { readonly userId: string }
): Promise<GetInvestorPortfolioResult> {
  const key = await dependencies.wallets.readPublicKey(input.userId);
  if (!key.ok) return { ok: false, error: { code: "unavailable" } };

  // No key means no account to read: an empty portfolio, not a failure.
  if (key.value === null) {
    return { ok: true, value: emptyPortfolio() };
  }

  const account = key.value;
  const [positions, distributions] = await Promise.all([
    dependencies.portfolio.listPositions(account),
    dependencies.portfolio.listDistributions(account)
  ]);

  if (!positions.ok || !distributions.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  try {
    return { ok: true, value: toSummary(positions.value, distributions.value, dependencies.now()) };
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
 * Converts the mirrored stroop total to whole ARS through the campaign's rate
 * snapshot. `null` when there is no snapshot, because a missing conversion is
 * "sin dato", never zero.
 */
function toRaisedArs(
  totalStroops: bigint,
  snapshot: PortfolioPositionRecord["rateSnapshot"]
): number | null {
  if (snapshot === undefined || snapshot.usdToArs <= 0n || snapshot.stroopsPerUsd <= 0n) return null;
  const ars = (totalStroops * snapshot.usdToArs) / (snapshot.stroopsPerUsd * RATE_SCALE);
  return Number(ars < 0n ? 0n : ars);
}

/** Derives the position's lifecycle from the persisted mirror, never the request. */
function deriveStatus(record: PortfolioPositionRecord, now: Date): PortfolioPosition["status"] {
  if (record.state === "settled") return "settled";
  if (record.state === "refundable") return "refunding";
  if (record.totalStroops >= record.goalStroops) return "settled";
  if (now.getTime() >= Date.parse(record.closeDate)) return "refunding";
  return "funding";
}

function toPosition(record: PortfolioPositionRecord, now: Date): PortfolioPosition {
  return {
    campaignId: record.campaignId,
    name: record.name,
    sector: record.sector,
    city: record.city,
    imageUrl: record.hasImage ? `/marketplace/campaigns/${record.campaignId}/image` : null,
    contributionXlm: toXlm(record.contributionStroops),
    raisedArs: toRaisedArs(record.totalStroops, record.rateSnapshot),
    goalArs: Number(record.goalArs),
    fundedPercentBps: toFundedPercentBps(record.totalStroops, record.goalStroops),
    status: deriveStatus(record, now),
    closeDate: record.closeDate,
    vaultAddress: record.vaultAddress
  };
}

function toDistribution(record: PortfolioDistributionRecord): PortfolioDistribution {
  return portfolioDistributionSchema.parse({
    distributionId: record.distributionId,
    campaignId: record.campaignId,
    campaignName: record.campaignName,
    period: record.period,
    amountXlm: toXlm(record.amountStroops),
    status: record.state
  });
}

/**
 * Shapes the two reads into the portable summary. The contributed total is the
 * sum of every position; the distributed total is the sum of **confirmed**
 * distributions only and is `null` when none is confirmed — a submitted
 * distribution has not moved money and a failed one moved none.
 */
function toSummary(
  positions: readonly PortfolioPositionRecord[],
  distributions: readonly PortfolioDistributionRecord[],
  now: Date
): PortfolioSummary {
  let contributedStroops = 0n;
  for (const position of positions) contributedStroops += position.contributionStroops;

  let confirmedStroops = 0n;
  let confirmedCount = 0;
  for (const distribution of distributions) {
    if (distribution.state === "confirmed") {
      confirmedStroops += distribution.amountStroops;
      confirmedCount += 1;
    }
  }

  return portfolioSummarySchema.parse({
    contributions: positions.map((position) => toPosition(position, now)),
    distributions: distributions.map(toDistribution),
    totals: {
      totalContributedXlm: toXlm(contributedStroops),
      totalDistributionsXlm: confirmedCount === 0 ? null : toXlm(confirmedStroops),
      campaignCount: positions.length
    }
  });
}

function emptyPortfolio(): PortfolioSummary {
  return {
    contributions: [],
    distributions: [],
    totals: { totalContributedXlm: "0.0000000", totalDistributionsXlm: null, campaignCount: 0 }
  };
}

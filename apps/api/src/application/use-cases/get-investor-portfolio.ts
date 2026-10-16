import { portfolioDistributionSchema, portfolioSummarySchema } from "@vaqcrow/contracts";
import type { CorrelationId, PortfolioDistribution, PortfolioPosition, PortfolioSummary } from "@vaqcrow/contracts";
import { contractExplorerUrl, transactionExplorerUrl } from "../explorer-url.js";
import type {
  PortfolioContributionTransactionRecord,
  PortfolioDistributionRecord,
  PortfolioPositionRecord,
  PortfolioRepositoryPort
} from "../ports/portfolio-repository-port.js";
import type { CampaignRepositoryPort } from "../ports/campaign-repository-port.js";
import { toChainCampaignSnapshot, type CampaignVaultChainPort } from "../ports/campaign-vault-chain-port.js";
import type { WalletRepositoryPort } from "../ports/wallet-repository-port.js";
import { reconcileCampaign } from "./reconcile-campaign.js";

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
 *
 * Positions that can still change on chain — an `open` campaign (withdraw) or a
 * `refundable` one (refund) — are checked against the vault when the `vault`
 * dependency is wired (#571). The chain is the truth: a position the vault
 * reports at zero is left out of the list, the total and the count, and any
 * other amount replaces the stored one. Each read is also reconciled into the
 * mirror, so the stale row is deleted, but that is best-effort and the response
 * does not depend on it. When the vault cannot be read, the stored position is
 * used: a down RPC never turns the portfolio into a 503.
 */

/** ARS per USD scale, matching `campaign-guardrails.ts`. Duplicated because use cases never import each other. */
const RATE_SCALE = 1_000_000n;
const STROOPS_PER_XLM = 10_000_000n;

export interface GetInvestorPortfolioDependencies {
  /** Resolves the verified principal's stored Stellar key (its profile column). */
  readonly wallets: Pick<WalletRepositoryPort, "readPublicKey">;
  readonly portfolio: Pick<PortfolioRepositoryPort, "listPositions" | "listDistributions" | "listContributionTransactions">;
  /** Injected for deterministic status derivation; `index.ts` passes `() => new Date()`. */
  readonly now: () => Date;
  /**
   * `StellarConfig.explorerUrl` (#438/WU3); `undefined` on the `local` network,
   * which turns every explorer link into `null`. The hashes are still returned.
   */
  readonly explorerBaseUrl: string | undefined;
  /**
   * The campaign vault reader and mirror (#571). Absent when the API runs
   * without the campaign group (no factory configured), in which case the
   * stored positions are served as they are.
   */
  readonly vault?: {
    readonly campaigns: Pick<CampaignRepositoryPort, "findById" | "reconcile">;
    readonly chain: Pick<CampaignVaultChainPort, "readCampaign" | "readContribution">;
  };
}

export type GetInvestorPortfolioResult =
  | { readonly ok: true; readonly value: PortfolioSummary }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function getInvestorPortfolio(
  dependencies: GetInvestorPortfolioDependencies,
  input: { readonly userId: string; readonly correlationId?: CorrelationId }
): Promise<GetInvestorPortfolioResult> {
  const key = await dependencies.wallets.readPublicKey(input.userId);
  if (!key.ok) return { ok: false, error: { code: "unavailable" } };

  // No key means no account to read: an empty portfolio, not a failure.
  if (key.value === null) {
    return { ok: true, value: emptyPortfolio() };
  }

  const account = key.value;
  const [positions, distributions, transactions] = await Promise.all([
    dependencies.portfolio.listPositions(account),
    dependencies.portfolio.listDistributions(account),
    dependencies.portfolio.listContributionTransactions(account)
  ]);

  if (!positions.ok || !distributions.ok || !transactions.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  const verified =
    dependencies.vault === undefined || input.correlationId === undefined
      ? positions.value
      : await verifyPositions(dependencies.vault, account, positions.value, input.correlationId);

  try {
    const links = explorerLinks(dependencies.explorerBaseUrl);
    return {
      ok: true,
      value: toSummary(verified, distributions.value, transactions.value, links, dependencies.now())
    };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}

/**
 * Re-reads every `open` or `refundable` position from its vault, in parallel.
 * A position at zero on chain is dropped; any other amount replaces the stored
 * one. A settled position cannot change and is kept as stored.
 */
async function verifyPositions(
  vault: NonNullable<GetInvestorPortfolioDependencies["vault"]>,
  account: string,
  positions: readonly PortfolioPositionRecord[],
  correlationId: CorrelationId
): Promise<readonly PortfolioPositionRecord[]> {
  const checked = await Promise.all(
    positions.map(async (position): Promise<PortfolioPositionRecord | null> => {
      if (position.state === "settled") return position;

      let campaign: Awaited<ReturnType<typeof vault.chain.readCampaign>>;
      let contribution: Awaited<ReturnType<typeof vault.chain.readContribution>>;
      try {
        [campaign, contribution] = await Promise.all([
          vault.chain.readCampaign(position.vaultAddress),
          vault.chain.readContribution(position.vaultAddress, account)
        ]);
      } catch {
        return position;
      }
      if (!campaign.ok || !contribution.ok) return position;

      // Heals the mirror (a zero deletes the stored row); its outcome does not
      // change what the chain just reported.
      try {
        await reconcileCampaign(vault.campaigns, {
          campaignId: position.campaignId,
          snapshot: toChainCampaignSnapshot(campaign.value, [
            {
              investorAccountId: account,
              amountStroops: contribution.value,
              lastObservedAt: campaign.value.observedAt.toISOString()
            }
          ]),
          correlationId
        });
      } catch {
        // Best-effort: the next read reconciles again.
      }

      if (contribution.value <= 0n) return null;
      return { ...position, contributionStroops: contribution.value };
    })
  );

  return checked.filter((position): position is PortfolioPositionRecord => position !== null);
}

interface ExplorerLinks {
  readonly transaction: (hash: string) => string | null;
  readonly contract: (address: string) => string | null;
}

/** Explorer links from the configured base; every link is `null` without one. */
function explorerLinks(base: string | undefined): ExplorerLinks {
  return {
    transaction: (hash) => (base === undefined ? null : transactionExplorerUrl(base, hash)),
    contract: (address) => (base === undefined ? null : contractExplorerUrl(base, address))
  };
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

function toPosition(
  record: PortfolioPositionRecord,
  transactions: readonly PortfolioContributionTransactionRecord[],
  links: ExplorerLinks,
  now: Date
): PortfolioPosition {
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
    vaultAddress: record.vaultAddress,
    vaultExplorerUrl: links.contract(record.vaultAddress),
    transactions: [...transactions]
      .sort(compareTransactions)
      .map((transaction) => ({
        transactionHash: transaction.transactionHash,
        amountXlm: toXlm(transaction.amountStroops),
        observedAt: transaction.observedAt,
        explorerUrl: links.transaction(transaction.transactionHash)
      }))
  };
}

/** Oldest observation first; the hash breaks ties so the order is stable. */
function compareTransactions(
  a: PortfolioContributionTransactionRecord,
  b: PortfolioContributionTransactionRecord
): number {
  const byTime = Date.parse(a.observedAt) - Date.parse(b.observedAt);
  if (byTime !== 0 && !Number.isNaN(byTime)) return byTime;
  return a.transactionHash < b.transactionHash ? -1 : a.transactionHash > b.transactionHash ? 1 : 0;
}

function toDistribution(record: PortfolioDistributionRecord, links: ExplorerLinks): PortfolioDistribution {
  return portfolioDistributionSchema.parse({
    distributionId: record.distributionId,
    campaignId: record.campaignId,
    campaignName: record.campaignName,
    period: record.period,
    amountXlm: toXlm(record.amountStroops),
    status: record.state,
    transactionHash: record.transactionHash,
    explorerUrl: links.transaction(record.transactionHash)
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
  transactions: readonly PortfolioContributionTransactionRecord[],
  links: ExplorerLinks,
  now: Date
): PortfolioSummary {
  // Each observed transaction is attached to its own campaign's position; one
  // whose campaign is not a position (not a deployed campaign) is dropped.
  const transactionsByCampaign = new Map<string, PortfolioContributionTransactionRecord[]>();
  for (const transaction of transactions) {
    const bucket = transactionsByCampaign.get(transaction.campaignId) ?? [];
    bucket.push(transaction);
    transactionsByCampaign.set(transaction.campaignId, bucket);
  }

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
    contributions: positions.map((position) =>
      toPosition(position, transactionsByCampaign.get(position.campaignId) ?? [], links, now)
    ),
    distributions: distributions.map((distribution) => toDistribution(distribution, links)),
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

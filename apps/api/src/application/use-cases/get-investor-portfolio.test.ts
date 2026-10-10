import { describe, expect, it, vi } from "vitest";
import type { PortfolioPositionRecord, PortfolioRepositoryPort } from "../ports/portfolio-repository-port.js";
import type { WalletRepositoryPort } from "../ports/wallet-repository-port.js";
import { getInvestorPortfolio } from "./get-investor-portfolio.js";

/**
 * The investor portfolio use case (#426, WU1).
 *
 * The account key is resolved server-side from the verified principal's
 * profile; the use case never accepts an account from a caller. Money stays
 * integer/bigint until the final canonical XLM string. A repository or key
 * failure is `unavailable`, never a half-built or silently shortened summary.
 */
const USER_ID = "00000000-0000-4000-8000-000000000001";
const ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const DISTRIBUTION_ID = "323e4567-e89b-42d3-a456-426614174000";
const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const SECOND_CAMPAIGN_ID = "223e4567-e89b-42d3-a456-426614174000";
const EXPLORER = "https://stellar.expert/explorer/testnet";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const DISTRIBUTION_HASH = "d".repeat(64);

const POSITION: PortfolioPositionRecord = {
  campaignId: CAMPAIGN_ID,
  name: "Panadería Sol",
  sector: "Alimentos",
  city: "CABA",
  contributionStroops: 1_500_000n,
  goalArs: 5_000_000n,
  totalStroops: 2_500_000n,
  goalStroops: 10_000_000n,
  state: "open",
  closeDate: "2026-12-01T00:00:00.000Z",
  vaultAddress: VAULT,
  hasImage: true,
  rateSnapshot: { usdToArs: 1_000_000_000n, stroopsPerUsd: 10_000_000n }
};

function fakeWallet(value: string | null, ok = true): Pick<WalletRepositoryPort, "readPublicKey"> {
  return {
    readPublicKey: async () => (ok ? { ok: true as const, value } : { ok: false as const, error: { code: "unavailable" } })
  };
}

function fakePortfolio(overrides: Partial<PortfolioRepositoryPort> = {}): PortfolioRepositoryPort {
  return {
    listPositions: async () => ({ ok: true as const, value: [POSITION] }),
    listDistributions: async () => ({ ok: true as const, value: [] }),
    listContributionTransactions: async () => ({ ok: true as const, value: [] }),
    ...overrides
  };
}

const NOW = () => new Date("2026-10-09T00:00:00.000Z");

describe("getInvestorPortfolio", () => {
  it("returns an empty portfolio without touching the repository when no wallet key is stored", async () => {
    const listPositions = vi.fn();
    const listDistributions = vi.fn();
    const listContributionTransactions = vi.fn();
    const result = await getInvestorPortfolio(
      {
        wallets: fakeWallet(null),
        portfolio: fakePortfolio({ listPositions, listDistributions, listContributionTransactions }),
        now: NOW,
        explorerBaseUrl: EXPLORER
      },
      { userId: USER_ID }
    );

    expect(result).toEqual({
      ok: true,
      value: {
        contributions: [],
        distributions: [],
        totals: { totalContributedXlm: "0.0000000", totalDistributionsXlm: null, campaignCount: 0 }
      }
    });
    expect(listPositions).not.toHaveBeenCalled();
    expect(listDistributions).not.toHaveBeenCalled();
    expect(listContributionTransactions).not.toHaveBeenCalled();
  });

  it("scopes both reads by the resolved account key, never a caller-supplied one", async () => {
    const listPositions = vi.fn(async () => ({ ok: true as const, value: [] }));
    const listDistributions = vi.fn(async () => ({ ok: true as const, value: [] }));
    const listContributionTransactions = vi.fn(async () => ({ ok: true as const, value: [] }));

    await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({ listPositions, listDistributions, listContributionTransactions }),
        now: NOW,
        explorerBaseUrl: EXPLORER
      },
      { userId: USER_ID }
    );

    expect(listPositions).toHaveBeenCalledWith(ACCOUNT);
    expect(listDistributions).toHaveBeenCalledWith(ACCOUNT);
    expect(listContributionTransactions).toHaveBeenCalledWith(ACCOUNT);
  });

  it("maps a position to canonical XLM and integer ARS through the campaign snapshot", async () => {
    const result = await getInvestorPortfolio(
      { wallets: fakeWallet(ACCOUNT), portfolio: fakePortfolio(), now: NOW, explorerBaseUrl: EXPLORER },
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contributions[0]).toEqual({
      campaignId: CAMPAIGN_ID,
      name: "Panadería Sol",
      sector: "Alimentos",
      city: "CABA",
      imageUrl: `/marketplace/campaigns/${CAMPAIGN_ID}/image`,
      contributionXlm: "0.1500000",
      raisedArs: 250,
      goalArs: 5_000_000,
      fundedPercentBps: 2500,
      status: "funding",
      closeDate: "2026-12-01T00:00:00.000Z",
      vaultAddress: VAULT,
      vaultExplorerUrl: `${EXPLORER}/contract/${VAULT}`,
      transactions: []
    });
    expect(result.value.totals).toEqual({
      totalContributedXlm: "0.1500000",
      totalDistributionsXlm: null,
      campaignCount: 1
    });
  });

  it("reports raisedArs null when the campaign has no rate snapshot (sin dato, never zero)", async () => {
    const bare: PortfolioPositionRecord = {
      campaignId: POSITION.campaignId,
      name: POSITION.name,
      sector: POSITION.sector,
      city: POSITION.city,
      contributionStroops: POSITION.contributionStroops,
      goalArs: POSITION.goalArs,
      totalStroops: POSITION.totalStroops,
      goalStroops: POSITION.goalStroops,
      state: POSITION.state,
      closeDate: POSITION.closeDate,
      vaultAddress: POSITION.vaultAddress,
      hasImage: false
    };
    const result = await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({ listPositions: async () => ({ ok: true as const, value: [bare] }) }),
        now: NOW,
        explorerBaseUrl: EXPLORER
      },
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contributions[0]?.raisedArs).toBeNull();
    expect(result.value.contributions[0]?.imageUrl).toBeNull();
  });

  it("derives settled/refunding from the persisted mirror, not the deadline alone", async () => {
    const settled: PortfolioPositionRecord = { ...POSITION, state: "settled", totalStroops: 10_000_000n };
    const refundable: PortfolioPositionRecord = { ...POSITION, state: "refundable" };
    const expiredOpen: PortfolioPositionRecord = { ...POSITION, closeDate: "2026-09-01T00:00:00.000Z" };

    const result = await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({
          listPositions: async () => ({ ok: true as const, value: [settled, refundable, expiredOpen] })
        }),
        now: NOW,
        explorerBaseUrl: EXPLORER
      },
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contributions.map((position) => position.status)).toEqual([
      "settled",
      "refunding",
      "refunding"
    ]);
  });

  it("sums only confirmed distributions and keeps the total null when none is confirmed", async () => {
    const rows = [
      { distributionId: DISTRIBUTION_ID, campaignId: CAMPAIGN_ID, campaignName: "Panadería Sol", period: "2026-06", amountStroops: 12_500_000n, state: "confirmed" as const, transactionHash: DISTRIBUTION_HASH },
      { distributionId: "423e4567-e89b-42d3-a456-426614174000", campaignId: CAMPAIGN_ID, campaignName: "Panadería Sol", period: "2026-07", amountStroops: 1_000_000n, state: "submitted" as const, transactionHash: HASH_A },
      { distributionId: "523e4567-e89b-42d3-a456-426614174000", campaignId: null, campaignName: null, period: null, amountStroops: 5_000_000n, state: "failed" as const, transactionHash: HASH_B }
    ];
    const result = await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({ listDistributions: async () => ({ ok: true as const, value: rows }) }),
        now: NOW,
        explorerBaseUrl: EXPLORER
      },
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.distributions).toHaveLength(3);
    expect(result.value.distributions[0]?.amountXlm).toBe("1.2500000");
    expect(result.value.distributions[2]?.campaignId).toBeNull();
    expect(result.value.totals.totalDistributionsXlm).toBe("1.2500000");
  });

  it("reports an unavailable read when the wallet key cannot be resolved", async () => {
    const result = await getInvestorPortfolio(
      { wallets: fakeWallet(null, false), portfolio: fakePortfolio(), now: NOW, explorerBaseUrl: EXPLORER },
      { userId: USER_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("reports unavailable when either list fails, never a partial summary", async () => {
    const failing = await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({ listDistributions: async () => ({ ok: false as const, error: { code: "unavailable" } }) }),
        now: NOW,
        explorerBaseUrl: EXPLORER
      },
      { userId: USER_ID }
    );

    expect(failing).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("links each distribution to its explorer transaction", async () => {
    const row = {
      distributionId: DISTRIBUTION_ID,
      campaignId: CAMPAIGN_ID,
      campaignName: "Panadería Sol",
      period: "2026-06",
      amountStroops: 12_500_000n,
      state: "confirmed" as const,
      transactionHash: DISTRIBUTION_HASH
    };
    const result = await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({ listDistributions: async () => ({ ok: true as const, value: [row] }) }),
        now: NOW,
        explorerBaseUrl: EXPLORER
      },
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.distributions[0]).toMatchObject({
      transactionHash: DISTRIBUTION_HASH,
      explorerUrl: `${EXPLORER}/tx/${DISTRIBUTION_HASH}`
    });
  });

  it("attaches each observed contribute transaction to its own position, oldest first", async () => {
    const second: PortfolioPositionRecord = { ...POSITION, campaignId: SECOND_CAMPAIGN_ID, name: "Panadería Norte" };
    const transactions = [
      { transactionHash: HASH_B, campaignId: CAMPAIGN_ID, amountStroops: 500_000n, observedAt: "2026-04-01T00:00:00.000Z" },
      { transactionHash: HASH_A, campaignId: CAMPAIGN_ID, amountStroops: 1_000_000n, observedAt: "2026-03-01T00:00:00.000Z" },
      { transactionHash: HASH_C, campaignId: SECOND_CAMPAIGN_ID, amountStroops: 2_000_000n, observedAt: "2026-05-01T00:00:00.000Z" }
    ];
    const result = await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({
          listPositions: async () => ({ ok: true as const, value: [POSITION, second] }),
          listContributionTransactions: async () => ({ ok: true as const, value: transactions })
        }),
        now: NOW,
        explorerBaseUrl: EXPLORER
      },
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contributions[0]?.transactions).toEqual([
      { transactionHash: HASH_A, amountXlm: "0.1000000", observedAt: "2026-03-01T00:00:00.000Z", explorerUrl: `${EXPLORER}/tx/${HASH_A}` },
      { transactionHash: HASH_B, amountXlm: "0.0500000", observedAt: "2026-04-01T00:00:00.000Z", explorerUrl: `${EXPLORER}/tx/${HASH_B}` }
    ]);
    expect(result.value.contributions[1]?.transactions.map((entry) => entry.transactionHash)).toEqual([HASH_C]);
  });

  it("drops a transaction whose campaign is not one of the investor's positions", async () => {
    const result = await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({
          listContributionTransactions: async () => ({
            ok: true as const,
            value: [{ transactionHash: HASH_C, campaignId: SECOND_CAMPAIGN_ID, amountStroops: 1n, observedAt: "2026-05-01T00:00:00.000Z" }]
          })
        }),
        now: NOW,
        explorerBaseUrl: EXPLORER
      },
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contributions[0]?.transactions).toEqual([]);
  });

  it("returns null explorer links when no explorer base is configured (local network)", async () => {
    const result = await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({
          listDistributions: async () => ({
            ok: true as const,
            value: [
              { distributionId: DISTRIBUTION_ID, campaignId: CAMPAIGN_ID, campaignName: "Panadería Sol", period: "2026-06", amountStroops: 1n, state: "confirmed" as const, transactionHash: DISTRIBUTION_HASH }
            ]
          }),
          listContributionTransactions: async () => ({
            ok: true as const,
            value: [{ transactionHash: HASH_A, campaignId: CAMPAIGN_ID, amountStroops: 1n, observedAt: "2026-03-01T00:00:00.000Z" }]
          })
        }),
        now: NOW,
        explorerBaseUrl: undefined
      },
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contributions[0]?.vaultExplorerUrl).toBeNull();
    expect(result.value.contributions[0]?.transactions[0]?.explorerUrl).toBeNull();
    expect(result.value.contributions[0]?.transactions[0]?.transactionHash).toBe(HASH_A);
    expect(result.value.distributions[0]?.explorerUrl).toBeNull();
    expect(result.value.distributions[0]?.transactionHash).toBe(DISTRIBUTION_HASH);
  });

  it("reports unavailable when the contribute transaction read fails, never a summary without hashes", async () => {
    const result = await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({
          listContributionTransactions: async () => ({ ok: false as const, error: { code: "unavailable" } })
        }),
        now: NOW,
        explorerBaseUrl: EXPLORER
      },
      { userId: USER_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

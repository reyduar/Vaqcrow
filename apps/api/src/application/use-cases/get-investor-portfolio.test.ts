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
    ...overrides
  };
}

const NOW = () => new Date("2026-10-09T00:00:00.000Z");

describe("getInvestorPortfolio", () => {
  it("returns an empty portfolio without touching the repository when no wallet key is stored", async () => {
    const listPositions = vi.fn();
    const listDistributions = vi.fn();
    const result = await getInvestorPortfolio(
      {
        wallets: fakeWallet(null),
        portfolio: fakePortfolio({ listPositions, listDistributions }),
        now: NOW
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
  });

  it("scopes both reads by the resolved account key, never a caller-supplied one", async () => {
    const listPositions = vi.fn(async () => ({ ok: true as const, value: [] }));
    const listDistributions = vi.fn(async () => ({ ok: true as const, value: [] }));

    await getInvestorPortfolio(
      { wallets: fakeWallet(ACCOUNT), portfolio: fakePortfolio({ listPositions, listDistributions }), now: NOW },
      { userId: USER_ID }
    );

    expect(listPositions).toHaveBeenCalledWith(ACCOUNT);
    expect(listDistributions).toHaveBeenCalledWith(ACCOUNT);
  });

  it("maps a position to canonical XLM and integer ARS through the campaign snapshot", async () => {
    const result = await getInvestorPortfolio(
      { wallets: fakeWallet(ACCOUNT), portfolio: fakePortfolio(), now: NOW },
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
      vaultAddress: VAULT
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
        now: NOW
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
        now: NOW
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
      { distributionId: DISTRIBUTION_ID, campaignId: CAMPAIGN_ID, campaignName: "Panadería Sol", period: "2026-06", amountStroops: 12_500_000n, state: "confirmed" as const },
      { distributionId: "423e4567-e89b-42d3-a456-426614174000", campaignId: CAMPAIGN_ID, campaignName: "Panadería Sol", period: "2026-07", amountStroops: 1_000_000n, state: "submitted" as const },
      { distributionId: "523e4567-e89b-42d3-a456-426614174000", campaignId: null, campaignName: null, period: null, amountStroops: 5_000_000n, state: "failed" as const }
    ];
    const result = await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({ listDistributions: async () => ({ ok: true as const, value: rows }) }),
        now: NOW
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
      { wallets: fakeWallet(null, false), portfolio: fakePortfolio(), now: NOW },
      { userId: USER_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("reports unavailable when either list fails, never a partial summary", async () => {
    const failing = await getInvestorPortfolio(
      {
        wallets: fakeWallet(ACCOUNT),
        portfolio: fakePortfolio({ listDistributions: async () => ({ ok: false as const, error: { code: "unavailable" } }) }),
        now: NOW
      },
      { userId: USER_ID }
    );

    expect(failing).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

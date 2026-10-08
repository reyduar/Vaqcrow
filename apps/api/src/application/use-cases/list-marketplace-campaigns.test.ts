import { describe, expect, it } from "vitest";
import type {
  MarketplaceCampaignRateSnapshot,
  MarketplaceCampaignRecord,
  MarketplaceCampaignRepositoryPort
} from "../ports/marketplace-campaign-repository-port.js";
import { listMarketplaceCampaigns } from "./list-marketplace-campaigns.js";

/**
 * The marketplace listing use case. The interesting logic is the integer-only
 * money conversion (stroops -> ARS through the campaign's own rate snapshot)
 * and the funded percentage; a repository failure must be `unavailable`, never
 * an empty-but-successful list.
 */
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";

// 1000.000000 ARS per USD (scaled 1e6) and 1 USD = 1 XLM = 10_000_000 stroops:
// 2_500_000 stroops = 0.25 USD = 250 ARS.
const SNAPSHOT: MarketplaceCampaignRateSnapshot = {
  version: 5,
  usdToArs: 1_000_000_000n,
  stroopsPerUsd: 10_000_000n
};

function record(
  overrides: Partial<MarketplaceCampaignRecord> = {},
  rateSnapshot: MarketplaceCampaignRateSnapshot | null = SNAPSHOT
): MarketplaceCampaignRecord {
  return {
    campaignId: CAMPAIGN_ID,
    name: "Panadería Sol",
    sector: "Alimentos",
    city: "CABA",
    goalArs: 1000n,
    totalStroops: 2_500_000n,
    goalStroops: 10_000_000n,
    revenueShare: 5,
    riskBand: "medium",
    riskConfidence: 0.72,
    closeDate: "2026-12-01T00:00:00.000Z",
    hasImage: false,
    ...(rateSnapshot === null ? {} : { rateSnapshot }),
    ...overrides
  };
}

function fakeRepository(
  value: Awaited<ReturnType<MarketplaceCampaignRepositoryPort["listPublished"]>>
): Pick<MarketplaceCampaignRepositoryPort, "listPublished"> {
  return { listPublished: async () => value };
}

describe("listMarketplaceCampaigns", () => {
  it("converts stroops to ARS through the snapshot and computes the funded percentage", async () => {
    const result = await listMarketplaceCampaigns({ repository: fakeRepository({ ok: true, value: [record()] }) });

    expect(result).toEqual({
      ok: true,
      value: {
        items: [
          {
            campaignId: CAMPAIGN_ID,
            name: "Panadería Sol",
            sector: "Alimentos",
            city: "CABA",
            goalArs: 1000,
            raisedArs: 250,
            fundedPercentBps: 2500,
            revenueShare: 5,
            riskBand: "medium",
            riskConfidence: 0.72,
            closeDate: "2026-12-01T00:00:00.000Z",
            imageUrl: null
          }
        ]
      }
    });
  });

  it("reports null raised ARS and null risk when there is no snapshot and no assessment", async () => {
    const bare = record({ riskBand: null, riskConfidence: null }, null);

    const result = await listMarketplaceCampaigns({ repository: fakeRepository({ ok: true, value: [bare] }) });

    expect(result).toEqual({
      ok: true,
      value: {
        items: [
          {
            campaignId: CAMPAIGN_ID,
            name: "Panadería Sol",
            sector: "Alimentos",
            city: "CABA",
            goalArs: 1000,
            raisedArs: null,
            fundedPercentBps: 2500,
            revenueShare: 5,
            riskBand: null,
            riskConfidence: null,
            closeDate: "2026-12-01T00:00:00.000Z",
            imageUrl: null
          }
        ]
      }
    });
  });

  it("clamps the funded percentage to 0..10000 basis points", async () => {
    const over = record({ totalStroops: 20_000_000n, goalStroops: 10_000_000n });
    const result = await listMarketplaceCampaigns({ repository: fakeRepository({ ok: true, value: [over] }) });

    expect(result.ok && result.value.items[0]?.fundedPercentBps).toBe(10_000);
  });

  it("maps a repository failure to unavailable, never an empty list", async () => {
    const result = await listMarketplaceCampaigns({
      repository: fakeRepository({ ok: false, error: { code: "unavailable" } })
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a malformed record to unavailable instead of returning a half-built card", async () => {
    const malformed = record({ riskBand: "critical" as unknown as MarketplaceCampaignRecord["riskBand"] });
    const result = await listMarketplaceCampaigns({ repository: fakeRepository({ ok: true, value: [malformed] }) });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("lists nothing (200, empty) when the repository returns no published campaigns", async () => {
    const result = await listMarketplaceCampaigns({ repository: fakeRepository({ ok: true, value: [] }) });

    expect(result).toEqual({ ok: true, value: { items: [] } });
  });

  it("points imageUrl at the API image path when the campaign has an image (#414/WU3)", async () => {
    const result = await listMarketplaceCampaigns({
      repository: fakeRepository({ ok: true, value: [record({ hasImage: true })] })
    });

    expect(result.ok && result.value.items[0]?.imageUrl).toBe(`/marketplace/campaigns/${CAMPAIGN_ID}/image`);
  });

  it("keeps imageUrl null when the campaign has no image", async () => {
    const result = await listMarketplaceCampaigns({
      repository: fakeRepository({ ok: true, value: [record({ hasImage: false })] })
    });

    expect(result.ok && result.value.items[0]?.imageUrl).toBeNull();
  });
});

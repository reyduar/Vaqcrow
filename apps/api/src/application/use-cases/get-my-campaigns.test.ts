import { describe, expect, it } from "vitest";
import type {
  MyCampaignDistributionRecord,
  MyCampaignRecord,
  MyCampaignSalesRecord
} from "../ports/my-campaigns-repository-port.js";
import { getMyCampaigns, type GetMyCampaignsDependencies } from "./get-my-campaigns.js";

/**
 * The PyME dashboard read model (#434, WU1).
 *
 * Every read is scoped to `request.principal.userId` (the owner), resolved by
 * the caller, never the request. Money is integer-only: ARS stays `bigint` and
 * XLM is the canonical seven-decimal string. A campaign with no FX snapshot
 * yields `raisedArs: null` and a distribution's `amountArs: null`; a missing
 * declared sale stays `null` — "sin dato", never a fabricated zero.
 */
const USER_ID = "00000000-0000-4000-8000-000000000003";
const CAMPAIGN_A = "123e4567-e89b-42d3-a456-426614174000";
const CAMPAIGN_B = "223e4567-e89b-42d3-a456-426614174000";
const DISTRIBUTION_A = "323e4567-e89b-42d3-a456-426614174000";
const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

const SNAPSHOT = { usdToArs: 1_000_000_000n, stroopsPerUsd: 10_000_000n };

function campaign(
  overrides: Partial<MyCampaignRecord> = {},
  options: { readonly noSnapshot?: boolean } = {}
): MyCampaignRecord {
  const base: MyCampaignRecord = {
    campaignId: CAMPAIGN_A,
    name: "Panadería Sol",
    sector: "Alimentos",
    city: "CABA",
    goalArs: 5_000_000n,
    totalStroops: 1_250_000n,
    goalStroops: 10_000_000n,
    state: "open",
    closeDate: "2026-12-01T00:00:00.000Z",
    vaultAddress: VAULT,
    hasImage: true,
    contributorsCount: 2,
    rateSnapshot: SNAPSHOT,
    ...overrides
  };
  if (options.noSnapshot) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping the snapshot to exercise the "sin dato" path
    const { rateSnapshot: _drop, ...rest } = base;
    return rest;
  }
  return base;
}

function dependencies(overrides: {
  readonly campaigns?: readonly MyCampaignRecord[];
  readonly distributions?: readonly MyCampaignDistributionRecord[];
  readonly sales?: readonly MyCampaignSalesRecord[];
  readonly fail?: "campaigns" | "distributions" | "sales";
} = {}): GetMyCampaignsDependencies {
  const unavailable = { ok: false as const, error: { code: "unavailable" as const } };
  return {
    myCampaigns: {
      listCampaigns: async () =>
        overrides.fail === "campaigns" ? unavailable : { ok: true as const, value: overrides.campaigns ?? [] },
      listDistributions: async () =>
        overrides.fail === "distributions"
          ? unavailable
          : { ok: true as const, value: overrides.distributions ?? [] },
      listSales: async () =>
        overrides.fail === "sales" ? unavailable : { ok: true as const, value: overrides.sales ?? [] }
    },
    now: () => new Date("2026-10-09T00:00:00.000Z")
  };
}

describe("getMyCampaigns", () => {
  it("returns an empty dashboard for a PyME with no campaigns, and still reads once", async () => {
    const result = await getMyCampaigns(dependencies(), { userId: USER_ID });

    expect(result).toEqual({ ok: true, value: { campaigns: [] } });
  });

  it("aggregates each campaign with its distributions and sales, converted through its snapshot", async () => {
    const result = await getMyCampaigns(
      dependencies({
        campaigns: [campaign()],
        distributions: [
          { campaignId: CAMPAIGN_A, distributionId: DISTRIBUTION_A, period: "2026-06", amountStroops: 12_500_000n, state: "confirmed" }
        ],
        sales: [
          { campaignId: CAMPAIGN_A, period: "2026-07", salesArs: null, status: "missing" },
          { campaignId: CAMPAIGN_A, period: "2026-06", salesArs: 9_000_000n, status: "reported" }
        ]
      }),
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [entry] = result.value.campaigns;
    expect(entry).toMatchObject({
      campaignId: CAMPAIGN_A,
      imageUrl: `/marketplace/campaigns/${CAMPAIGN_A}/image`,
      state: "funding",
      goalArs: 5_000_000,
      // 0.125 XLM * 1,000 ARS/XLM = 125 ARS.
      raisedArs: 125,
      fundedPercentBps: 1250,
      contributorsCount: 2
    });
    // 1.25 XLM * 1,000 ARS/XLM = 1,250 ARS.
    expect(entry?.distributions).toEqual([
      { distributionId: DISTRIBUTION_A, period: "2026-06", amountArs: 1_250, amountXlm: "1.2500000", state: "confirmed" }
    ]);
    expect(entry?.sales).toEqual([
      { period: "2026-06", salesArs: 9_000_000, status: "reported" },
      { period: "2026-07", salesArs: null, status: "missing" }
    ]);
  });

  it("keeps two campaigns apart and maps each one's own rows", async () => {
    const result = await getMyCampaigns(
      dependencies({
        campaigns: [
          campaign(),
          campaign({ campaignId: CAMPAIGN_B, name: "Panadería Norte", hasImage: false, contributorsCount: 0 })
        ],
        distributions: [
          { campaignId: CAMPAIGN_B, distributionId: DISTRIBUTION_A, period: "2026-05", amountStroops: 1_000_000n, state: "submitted" }
        ],
        sales: []
      }),
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.campaigns.map((entry) => entry.campaignId)).toEqual([CAMPAIGN_A, CAMPAIGN_B]);
    expect(result.value.campaigns[0]?.distributions).toEqual([]);
    expect(result.value.campaigns[1]?.imageUrl).toBeNull();
    expect(result.value.campaigns[1]?.distributions).toEqual([
      { distributionId: DISTRIBUTION_A, period: "2026-05", amountArs: 100, amountXlm: "0.1000000", state: "submitted" }
    ]);
  });

  it("leaves money null, never zero, for a campaign without a rate snapshot or with legacy rows", async () => {
    const result = await getMyCampaigns(
      dependencies({
        campaigns: [campaign({ totalStroops: 0n }, { noSnapshot: true })],
        distributions: [
          { campaignId: CAMPAIGN_A, distributionId: DISTRIBUTION_A, period: null, amountStroops: 7_000_000n, state: "failed" }
        ],
        sales: []
      }),
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [entry] = result.value.campaigns;
    expect(entry?.raisedArs).toBeNull();
    expect(entry?.distributions[0]).toEqual({
      distributionId: DISTRIBUTION_A,
      period: null,
      amountArs: null,
      amountXlm: "0.7000000",
      state: "failed"
    });
  });

  it("derives the settled and refunding states from the persisted mirror", async () => {
    const result = await getMyCampaigns(
      dependencies({
        campaigns: [
          campaign({ campaignId: CAMPAIGN_A, state: "settled" }),
          campaign({ campaignId: CAMPAIGN_B, state: "refundable" })
        ]
      }),
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.campaigns.map((entry) => entry.state)).toEqual(["settled", "refunding"]);
  });

  it("derives settled from a reached goal and refunding from a passed deadline", async () => {
    const result = await getMyCampaigns(
      dependencies({
        campaigns: [
          campaign({ campaignId: CAMPAIGN_A, state: "open", totalStroops: 10_000_000n }),
          campaign({ campaignId: CAMPAIGN_B, state: "open", closeDate: "2026-01-01T00:00:00.000Z" })
        ]
      }),
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.campaigns.map((entry) => entry.state)).toEqual(["settled", "refunding"]);
  });

  it("answers unavailable when any read fails", async () => {
    for (const fail of ["campaigns", "distributions", "sales"] as const) {
      expect(await getMyCampaigns(dependencies({ fail }), { userId: USER_ID })).toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
    }
  });

  it("does not depend on any caller-supplied identity beyond the owner it is given", async () => {
    const seen: string[] = [];
    const deps: GetMyCampaignsDependencies = {
      myCampaigns: {
        listCampaigns: async (owner) => {
          seen.push(`campaigns:${owner}`);
          return { ok: true, value: [] };
        },
        listDistributions: async (owner) => {
          seen.push(`distributions:${owner}`);
          return { ok: true, value: [] };
        },
        listSales: async (owner) => {
          seen.push(`sales:${owner}`);
          return { ok: true, value: [] };
        }
      },
      now: () => new Date("2026-10-09T00:00:00.000Z")
    };

    await getMyCampaigns(deps, { userId: USER_ID });

    expect(seen).toEqual([
      `campaigns:${USER_ID}`,
      `distributions:${USER_ID}`,
      `sales:${USER_ID}`
    ]);
  });
});

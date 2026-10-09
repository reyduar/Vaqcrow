import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseMyCampaignsRepository } from "./supabase-my-campaigns-repository.js";

/**
 * The PyME dashboard read adapter (#434, WU1). It reads the three
 * service_role-only views, filters by the resolved owner user id, and maps
 * PostgREST's text/numeric columns back to typed records. A malformed row or a
 * provider error is `unavailable`; the provider's message/details/hint and the
 * private object path never reach the caller.
 */
const OWNER = "00000000-0000-4000-8000-000000000003";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const DISTRIBUTION_ID = "323e4567-e89b-42d3-a456-426614174000";

const SUMMARY_ROW = {
  owner_user_id: OWNER,
  campaign_id: CAMPAIGN_ID,
  name: "Panadería Sol",
  sector: "Alimentos",
  city: "CABA",
  goal_ars: "5000000",
  total_stroops: "1250000",
  goal_stroops: "10000000",
  contract_address: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  state: "open",
  deadline: "2026-12-01T00:00:00.000Z",
  created_at: "2026-03-01T00:00:00.000Z",
  fx_rate_version: "5",
  usd_to_ars: "1000000000",
  stroops_per_usd: "10000000",
  contributors_count: "2",
  image_object_path: "owner/photo/a.jpg",
  image_content_type: "image/jpeg"
};

const DISTRIBUTION_ROW = {
  owner_user_id: OWNER,
  campaign_id: CAMPAIGN_ID,
  distribution_id: DISTRIBUTION_ID,
  period: "2026-06",
  state: "confirmed",
  amount_stroops: "12500000"
};

const SALES_ROW = {
  owner_user_id: OWNER,
  campaign_id: CAMPAIGN_ID,
  period: "2026-06",
  sales_ars: "9000000",
  status: "reported"
};

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

function fakeClient(perTable: Record<string, FakeStep>): {
  client: SupabaseClient;
  from: string[];
  eq: Array<readonly [string, unknown]>;
  order: Array<readonly [string, unknown]>;
} {
  const from: string[] = [];
  const eq: Array<readonly [string, unknown]> = [];
  const order: Array<readonly [string, unknown]> = [];
  const client = {
    from: (table: string) => {
      from.push(table);
      const step = perTable[table] ?? { data: [] };
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          eq.push([column, value]);
          return builder;
        },
        order: (column: string, options: unknown) => {
          order.push([column, options]);
          return builder;
        },
        then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
          const settled = step.reject
            ? Promise.reject(step.reject)
            : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });
          return settled.then(onFulfilled, onRejected);
        }
      };
      return builder;
    }
  } as unknown as SupabaseClient;
  return { client, from, eq, order };
}

describe("SupabaseMyCampaignsRepository", () => {
  it("reads the summary view scoped by the owner, newest first", async () => {
    const { client, from, eq, order } = fakeClient({ my_campaign_summary: { data: [SUMMARY_ROW] } });

    const result = await new SupabaseMyCampaignsRepository(client).listCampaigns(OWNER);

    expect(from).toEqual(["my_campaign_summary"]);
    expect(eq).toEqual([["owner_user_id", OWNER]]);
    expect(order).toEqual([["created_at", { ascending: false }]]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          campaignId: CAMPAIGN_ID,
          name: "Panadería Sol",
          sector: "Alimentos",
          city: "CABA",
          goalArs: 5_000_000n,
          totalStroops: 1_250_000n,
          goalStroops: 10_000_000n,
          state: "open",
          closeDate: "2026-12-01T00:00:00.000Z",
          vaultAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
          hasImage: true,
          contributorsCount: 2,
          rateSnapshot: { usdToArs: 1_000_000_000n, stroopsPerUsd: 10_000_000n }
        }
      ]
    });
  });

  it("maps a bare campaign (no image, no rate snapshot, no contributors) honestly", async () => {
    const bare = {
      ...SUMMARY_ROW,
      image_object_path: null,
      image_content_type: null,
      fx_rate_version: null,
      usd_to_ars: null,
      stroops_per_usd: null,
      contributors_count: "0"
    };
    const { client } = fakeClient({ my_campaign_summary: { data: [bare] } });

    const result = await new SupabaseMyCampaignsRepository(client).listCampaigns(OWNER);

    expect(result.ok && result.value[0]?.hasImage).toBe(false);
    expect(result.ok && result.value[0]?.rateSnapshot).toBeUndefined();
    expect(result.ok && result.value[0]?.contributorsCount).toBe(0);
  });

  it("reads the distributions view scoped by the owner, by period", async () => {
    const { client, from, eq, order } = fakeClient({ my_campaign_distribution: { data: [DISTRIBUTION_ROW] } });

    const result = await new SupabaseMyCampaignsRepository(client).listDistributions(OWNER);

    expect(from).toEqual(["my_campaign_distribution"]);
    expect(eq).toEqual([["owner_user_id", OWNER]]);
    expect(order).toEqual([["period", { ascending: true }]]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          campaignId: CAMPAIGN_ID,
          distributionId: DISTRIBUTION_ID,
          period: "2026-06",
          amountStroops: 12_500_000n,
          state: "confirmed"
        }
      ]
    });
  });

  it("keeps a legacy distribution's null period", async () => {
    const legacy = { ...DISTRIBUTION_ROW, period: null, state: "failed" };
    const { client } = fakeClient({ my_campaign_distribution: { data: [legacy] } });

    const result = await new SupabaseMyCampaignsRepository(client).listDistributions(OWNER);

    expect(result.ok && result.value[0]).toMatchObject({ period: null, state: "failed" });
  });

  it("reads the sales view scoped by the owner, by campaign then period", async () => {
    const { client, from, eq, order } = fakeClient({ my_campaign_sales: { data: [SALES_ROW] } });

    const result = await new SupabaseMyCampaignsRepository(client).listSales(OWNER);

    expect(from).toEqual(["my_campaign_sales"]);
    expect(eq).toEqual([["owner_user_id", OWNER]]);
    expect(order).toEqual([
      ["campaign_id", { ascending: true }],
      ["period", { ascending: true }]
    ]);
    expect(result).toEqual({
      ok: true,
      value: [{ campaignId: CAMPAIGN_ID, period: "2026-06", salesArs: 9_000_000n, status: "reported" }]
    });
  });

  it("keeps a missing month's null sale instead of zero", async () => {
    const missing = { ...SALES_ROW, period: "2026-07", sales_ars: null, status: "missing" };
    const { client } = fakeClient({ my_campaign_sales: { data: [missing] } });

    const result = await new SupabaseMyCampaignsRepository(client).listSales(OWNER);

    expect(result.ok && result.value[0]?.salesArs).toBeNull();
  });

  it("reports unavailable on a provider error, never leaking its text", async () => {
    const { client } = fakeClient({
      my_campaign_summary: { error: { code: "PGRST500", message: "secret detail", details: "d", hint: "h" } }
    });

    const result = await new SupabaseMyCampaignsRepository(client).listCampaigns(OWNER);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("secret detail");
  });

  it("reports unavailable on a malformed row or state", async () => {
    const badState = fakeClient({ my_campaign_summary: { data: [{ ...SUMMARY_ROW, state: "bogus" }] } });
    const notArray = fakeClient({ my_campaign_sales: { data: { not: "an array" } } });

    expect(await new SupabaseMyCampaignsRepository(badState.client).listCampaigns(OWNER)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    expect(await new SupabaseMyCampaignsRepository(notArray.client).listSales(OWNER)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

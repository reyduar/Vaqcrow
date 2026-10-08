import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseMarketplaceCampaignRepository } from "./supabase-marketplace-campaign-repository.js";

/**
 * The marketplace read adapter. It reads the joined `marketplace_campaign`
 * view (one row per published campaign) and maps PostgREST's text/numeric
 * columns back to typed records. A malformed row or a provider error is
 * `unavailable`; the provider's message/details/hint never reach the caller.
 */
const ROW = {
  campaign_id: "123e4567-e89b-42d3-a456-426614174000",
  name: "Panadería Sol",
  sector: "Alimentos",
  city: "CABA",
  goal_ars: "5000000",
  revenue_share: 5,
  total_stroops: "1500000",
  goal_stroops: "10000000",
  deadline: "2026-12-01T00:00:00.000Z",
  risk_band: "medium",
  risk_confidence: "0.72",
  fx_rate_version: "5",
  usd_to_ars: "1000000000",
  stroops_per_usd: "10000000",
  image_object_path: null,
  image_content_type: null
};

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

function fakeClient(step: FakeStep): {
  client: SupabaseClient;
  from: string[];
  select: string[];
  order: Array<readonly [string, unknown]>;
  eq: Array<readonly [string, unknown]>;
} {
  const from: string[] = [];
  const select: string[] = [];
  const order: Array<readonly [string, unknown]> = [];
  const eq: Array<readonly [string, unknown]> = [];
  const settle = () =>
    step.reject ? Promise.reject(step.reject) : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });
  const builder = {
    select: (columns?: string) => {
      if (typeof columns === "string") select.push(columns);
      return builder;
    },
    order: (column: string, options: unknown) => {
      order.push([column, options]);
      return builder;
    },
    eq: (column: string, value: unknown) => {
      eq.push([column, value]);
      return builder;
    },
    maybeSingle: () => settle(),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      settle().then(onFulfilled, onRejected)
  };
  return {
    client: {
      from: (table: string) => {
        from.push(table);
        return builder;
      }
    } as unknown as SupabaseClient,
    from,
    select,
    order,
    eq
  };
}

describe("SupabaseMarketplaceCampaignRepository.listPublished", () => {
  it("reads the joined view ordered by deadline and maps a full row", async () => {
    const { client, from, order } = fakeClient({ data: [ROW] });

    const result = await new SupabaseMarketplaceCampaignRepository(client).listPublished();

    expect(from).toEqual(["marketplace_campaign"]);
    expect(order).toEqual([["deadline", { ascending: true }]]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          campaignId: ROW.campaign_id,
          name: "Panadería Sol",
          sector: "Alimentos",
          city: "CABA",
          goalArs: 5_000_000n,
          totalStroops: 1_500_000n,
          goalStroops: 10_000_000n,
          revenueShare: 5,
          riskBand: "medium",
          riskConfidence: 0.72,
          closeDate: "2026-12-01T00:00:00.000Z",
          hasImage: false,
          rateSnapshot: { version: 5, usdToArs: 1_000_000_000n, stroopsPerUsd: 10_000_000n }
        }
      ]
    });
  });

  it("reports hasImage true when the view exposes an image document (#414/WU3)", async () => {
    const withImage = { ...ROW, image_object_path: "owner/photo/a.jpg", image_content_type: "image/jpeg" };
    const { client } = fakeClient({ data: [withImage] });

    const result = await new SupabaseMarketplaceCampaignRepository(client).listPublished();

    expect(result.ok && result.value[0]?.hasImage).toBe(true);
  });

  it("maps a row with no assessment and no rate snapshot to nulls", async () => {
    const bare = {
      ...ROW,
      risk_band: null,
      risk_confidence: null,
      usd_to_ars: null,
      stroops_per_usd: null,
      fx_rate_version: null
    };
    const { client } = fakeClient({ data: [bare] });

    const result = await new SupabaseMarketplaceCampaignRepository(client).listPublished();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({
      riskBand: null,
      riskConfidence: null
    });
    expect(result.value[0]?.rateSnapshot).toBeUndefined();
  });

  it("accepts a numeric revenue share that PostgREST returned as a number or a string", async () => {
    const { client } = fakeClient({ data: [{ ...ROW, revenue_share: "5.5", risk_confidence: 0.5 }] });

    const result = await new SupabaseMarketplaceCampaignRepository(client).listPublished();

    expect(result.ok && result.value[0]?.revenueShare).toBe(5.5);
    expect(result.ok && result.value[0]?.riskConfidence).toBe(0.5);
  });

  it("is unavailable on a provider error, a null payload or a malformed row", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sentinel = "SENTINEL-marketplace-row-detail";
    const steps: FakeStep[] = [
      { error: { code: "XX000", message: sentinel, details: sentinel, hint: sentinel } },
      { data: null },
      { data: [{ ...ROW, risk_band: "critical" }] },
      { data: [{ ...ROW, revenue_share: "abc" }] },
      { data: [{ ...ROW, goal_ars: "abc" }] }
    ];

    for (const step of steps) {
      const { client } = fakeClient(step);
      expect(await new SupabaseMarketplaceCampaignRepository(client).listPublished()).toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
    }

    expect(JSON.stringify(logged.mock.calls)).not.toContain(sentinel);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

describe("SupabaseMarketplaceCampaignRepository.findPublishedImage", () => {
  it("reads the image descriptor for a published campaign by campaign_id (#414/WU3)", async () => {
    const row = { image_object_path: "owner/photo/a.jpg", image_content_type: "image/jpeg" };
    const { client, from, select, eq } = fakeClient({ data: row });

    const result = await new SupabaseMarketplaceCampaignRepository(client).findPublishedImage(ROW.campaign_id);

    expect(from).toEqual(["marketplace_campaign"]);
    expect(select).toEqual(["image_object_path,image_content_type"]);
    expect(eq).toEqual([["campaign_id", ROW.campaign_id]]);
    expect(result).toEqual({
      ok: true,
      value: { objectPath: "owner/photo/a.jpg", contentType: "image/jpeg" }
    });
  });

  it("is undefined when the campaign is not published or has no image", async () => {
    const missing = fakeClient({ data: null });
    expect(await new SupabaseMarketplaceCampaignRepository(missing.client).findPublishedImage(ROW.campaign_id)).toEqual({
      ok: true,
      value: undefined
    });

    const noImage = fakeClient({ data: { image_object_path: null, image_content_type: null } });
    expect(
      await new SupabaseMarketplaceCampaignRepository(noImage.client).findPublishedImage(ROW.campaign_id)
    ).toEqual({ ok: true, value: undefined });
  });

  it("is unavailable on a provider error or a malformed image row", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sentinel = "SENTINEL-marketplace-image-detail";
    const steps: FakeStep[] = [
      { error: { code: "XX000", message: sentinel, details: sentinel, hint: sentinel } },
      { reject: new Error(sentinel) },
      { data: { image_object_path: "owner/photo/a.pdf", image_content_type: "application/pdf" } },
      { data: { image_object_path: "", image_content_type: "image/jpeg" } }
    ];

    for (const step of steps) {
      const { client } = fakeClient(step);
      expect(await new SupabaseMarketplaceCampaignRepository(client).findPublishedImage(ROW.campaign_id)).toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
    }

    expect(JSON.stringify(logged.mock.calls)).not.toContain(sentinel);
    logged.mockRestore();
  });
});

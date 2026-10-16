import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseCampaignDetailRepository } from "./supabase-campaign-detail-repository.js";

/**
 * Row mapping of the `marketplace_campaign_detail` view, scoped to the PyME's
 * declared use of funds (#577): the appended `use_of_funds` column is read as
 * nullable text, and a non-text value is a malformed row (`unavailable`).
 */
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";

const ROW = {
  campaign_id: CAMPAIGN_ID,
  name: "Panadería Sol",
  sector: "Alimentos",
  city: "CABA",
  description: "Panadería artesanal con tres locales",
  founded_at: "2024-03-01T00:00:00+00:00",
  goal_ars: "5000000",
  total_stroops: "0",
  goal_stroops: "10000000",
  revenue_share: 5,
  deadline: "2026-12-01T00:00:00+00:00",
  state: "open",
  vault_address: null,
  backers: 0,
  assessment_present: false,
  decision_actor: null,
  image_object_path: null,
  image_content_type: null,
  fx_rate_version: null,
  sales_months: null
};

function fakeClient(data: unknown): SupabaseClient {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data, error: null })
  };
  return { from: () => query } as unknown as SupabaseClient;
}

describe("SupabaseCampaignDetailRepository use of funds (#577)", () => {
  it("reads the declared use of funds from the view", async () => {
    const result = await new SupabaseCampaignDetailRepository(
      fakeClient({ ...ROW, use_of_funds: "Un segundo horno" })
    ).findPublished(CAMPAIGN_ID);

    expect(result.ok && result.value?.useOfFunds).toBe("Un segundo horno");
  });

  it("maps a NULL or absent use of funds to null (the honest sin dato)", async () => {
    const withNull = await new SupabaseCampaignDetailRepository(fakeClient({ ...ROW, use_of_funds: null })).findPublished(
      CAMPAIGN_ID
    );
    const absent = await new SupabaseCampaignDetailRepository(fakeClient(ROW)).findPublished(CAMPAIGN_ID);

    expect(withNull.ok && withNull.value?.useOfFunds).toBeNull();
    expect(absent.ok && absent.value?.useOfFunds).toBeNull();
    expect(absent.ok && absent.value?.description).toBe("Panadería artesanal con tres locales");
  });

  it("is unavailable when the stored use of funds is not text", async () => {
    const result = await new SupabaseCampaignDetailRepository(fakeClient({ ...ROW, use_of_funds: 42 })).findPublished(
      CAMPAIGN_ID
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

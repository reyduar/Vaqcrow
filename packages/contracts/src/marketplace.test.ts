import { describe, expect, it } from "vitest";
import {
  marketplaceCampaignListSchema,
  marketplaceCampaignSchema,
  parseMarketplaceCampaignList
} from "./index.js";

/**
 * The public marketplace card (`GET /marketplace/campaigns`). These tests fix
 * the wire shape before the schema exists: a published campaign carries only
 * public facts, `imageUrl` is reserved for WU3, and both levels are strict so a
 * response that drifted from the contract is an error, never a half-trusted
 * object.
 */
const CAMPAIGN = {
  campaignId: "123e4567-e89b-42d3-a456-426614174000",
  name: "Panadería Sol",
  sector: "Alimentos",
  city: "CABA",
  goalArs: 5_000_000,
  raisedArs: 1_500_000,
  fundedPercentBps: 3000,
  revenueShare: 5,
  riskBand: "medium",
  riskConfidence: 0.72,
  closeDate: "2026-12-01T00:00:00.000Z",
  imageUrl: null
};

describe("marketplace campaign contracts", () => {
  it("accepts a published campaign card and its list envelope", () => {
    expect(parseMarketplaceCampaignList({ items: [CAMPAIGN] })).toEqual({ items: [CAMPAIGN] });
  });

  it("accepts the no-snapshot / no-assessment case as nulls", () => {
    const bare = {
      ...CAMPAIGN,
      raisedArs: null,
      riskBand: null,
      riskConfidence: null
    };
    expect(marketplaceCampaignSchema.safeParse(bare).success).toBe(true);
  });

  it("accepts only the API-relative campaign image path, never an absolute URL (#414/WU3)", () => {
    const imageUrl = `/marketplace/campaigns/${CAMPAIGN.campaignId}/image`;
    expect(marketplaceCampaignSchema.safeParse({ ...CAMPAIGN, imageUrl }).success).toBe(true);
    // The bytes are proxied by the API; the storage object path and any absolute
    // URL (a signed storage link) must never be accepted on the wire.
    expect(
      marketplaceCampaignSchema.safeParse({ ...CAMPAIGN, imageUrl: "https://cdn.example.test/a.png" }).success
    ).toBe(false);
    expect(
      marketplaceCampaignSchema.safeParse({ ...CAMPAIGN, imageUrl: "/pyme-documents/owner/photo/a.jpg" }).success
    ).toBe(false);
    expect(marketplaceCampaignSchema.safeParse({ ...CAMPAIGN, imageUrl: "not-a-url" }).success).toBe(false);
  });

  it("is strict: an unknown key on the card or the envelope is rejected", () => {
    expect(marketplaceCampaignSchema.safeParse({ ...CAMPAIGN, ownerUserId: "leak" }).success).toBe(false);
    expect(marketplaceCampaignListSchema.safeParse({ items: [CAMPAIGN], page: 1 }).success).toBe(false);
  });

  it("rejects an unknown risk band, a bps outside 0..10000, and a non-integer ARS amount", () => {
    expect(marketplaceCampaignSchema.safeParse({ ...CAMPAIGN, riskBand: "critical" }).success).toBe(false);
    expect(marketplaceCampaignSchema.safeParse({ ...CAMPAIGN, fundedPercentBps: 10_001 }).success).toBe(false);
    expect(marketplaceCampaignSchema.safeParse({ ...CAMPAIGN, goalArs: 1.5 }).success).toBe(false);
  });
});

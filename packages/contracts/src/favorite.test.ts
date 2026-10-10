import { describe, expect, it } from "vitest";
import {
  favoriteCampaignListSchema,
  favoriteCampaignResultSchema,
  parseFavoriteCampaignList,
  parseFavoriteCampaignResult
} from "./index.js";

/**
 * The per-account favorites surface (#414/WU2). `GET /favorites` answers the
 * id-list envelope; `PUT`/`DELETE /favorites/:campaignId` answer the
 * add/remove result. Both shapes are strict, so a response that drifted from
 * the contract is an error, never a half-trusted object.
 */
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("favorite campaign contracts", () => {
  it("accepts the favorites list envelope and an empty list", () => {
    expect(parseFavoriteCampaignList({ campaignIds: [CAMPAIGN_ID] })).toEqual({ campaignIds: [CAMPAIGN_ID] });
    expect(favoriteCampaignListSchema.safeParse({ campaignIds: [] }).success).toBe(true);
  });

  it("accepts the add/remove result for both outcomes", () => {
    expect(parseFavoriteCampaignResult({ campaignId: CAMPAIGN_ID, applied: true })).toEqual({
      campaignId: CAMPAIGN_ID,
      applied: true
    });
    expect(favoriteCampaignResultSchema.safeParse({ campaignId: CAMPAIGN_ID, applied: false }).success).toBe(true);
  });

  it("is strict: an unknown key on either shape is rejected", () => {
    expect(favoriteCampaignListSchema.safeParse({ campaignIds: [], userId: "leak" }).success).toBe(false);
    expect(
      favoriteCampaignResultSchema.safeParse({ campaignId: CAMPAIGN_ID, applied: true, ownerUserId: "leak" }).success
    ).toBe(false);
  });

  it("rejects a non-uuid campaign id and a non-boolean applied flag", () => {
    expect(favoriteCampaignListSchema.safeParse({ campaignIds: ["not-a-uuid"] }).success).toBe(false);
    expect(favoriteCampaignResultSchema.safeParse({ campaignId: "nope", applied: true }).success).toBe(false);
    expect(favoriteCampaignResultSchema.safeParse({ campaignId: CAMPAIGN_ID, applied: "yes" }).success).toBe(false);
  });
});

import { z } from "zod";
import { campaignIdSchema } from "./campaign.js";

/**
 * The per-account favorites surface (#414/WU2).
 *
 * `GET /favorites` answers the caller's saved campaign ids; `PUT` and `DELETE
 * /favorites/:campaignId` answer the add/remove result. The owner never travels
 * on the wire — it is always the verified principal — so no user id appears in
 * either shape, and both are strict so a drifted response is an error.
 */
export const favoriteCampaignListSchema = z.strictObject({
  campaignIds: z.array(campaignIdSchema)
});

export type FavoriteCampaignList = z.infer<typeof favoriteCampaignListSchema>;

export const favoriteCampaignResultSchema = z.strictObject({
  campaignId: campaignIdSchema,
  applied: z.boolean()
});

export type FavoriteCampaignResult = z.infer<typeof favoriteCampaignResultSchema>;

export function parseFavoriteCampaignList(input: unknown): FavoriteCampaignList {
  return favoriteCampaignListSchema.parse(input);
}

export function parseFavoriteCampaignResult(input: unknown): FavoriteCampaignResult {
  return favoriteCampaignResultSchema.parse(input);
}

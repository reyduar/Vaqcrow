import { z } from "zod";
import { campaignIdSchema } from "./campaign.js";

/**
 * The public marketplace card (`GET /marketplace/campaigns`).
 *
 * Only published campaigns (a confirmed vault deployment and an `open`
 * campaign) are listed, and only public PyME facts travel: no owner id, no
 * documents, no PII. `raisedArs` is a snapshot conversion of the mirrored
 * stroop total through the campaign's own integer FX rate (`null` when the
 * campaign predates the snapshot, matching the honest "sin dato" rule); the
 * funded percentage is basis points, exactly `total_stroops * 10000 /
 * goal_stroops` clamped to `0..10000`.
 *
 * `imageUrl` is reserved for WU3 (the real PyME photo served by the API) and is
 * always `null` for now.
 */
export const riskBandSchema = z.enum(["low", "medium", "high"]);

export type RiskBand = z.infer<typeof riskBandSchema>;

export const marketplaceCampaignSchema = z.strictObject({
  campaignId: campaignIdSchema,
  name: z.string().trim().min(1),
  sector: z.string().trim().min(1),
  city: z.string().trim().min(1),
  goalArs: z.number().int().nonnegative(),
  raisedArs: z.number().int().nonnegative().nullable(),
  fundedPercentBps: z.number().int().min(0).max(10_000),
  /** The revenue-share percent the PyME offers, from `businesses.revenue_share`. */
  revenueShare: z.number().min(0),
  riskBand: riskBandSchema.nullable(),
  riskConfidence: z.number().min(0).max(1).nullable(),
  closeDate: z.iso.datetime({ offset: true }),
  imageUrl: z.url().nullable()
});

export type MarketplaceCampaign = z.infer<typeof marketplaceCampaignSchema>;

/** `GET /marketplace/campaigns` response: one unpaginated list (owner decision D3). */
export const marketplaceCampaignListSchema = z.strictObject({
  items: z.array(marketplaceCampaignSchema)
});

export type MarketplaceCampaignList = z.infer<typeof marketplaceCampaignListSchema>;

export function parseMarketplaceCampaignList(input: unknown): MarketplaceCampaignList {
  return marketplaceCampaignListSchema.parse(input);
}

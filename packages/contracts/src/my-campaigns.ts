import { z } from "zod";
import { campaignIdSchema, stellarContractIdSchema } from "./campaign.js";
import { marketplaceCampaignImageUrlSchema } from "./marketplace.js";
import { xlmAmountSchema } from "./portfolio.js";
import { revenueShareDistributionIdSchema } from "./revenue-share-distribution-id.js";
import { periodSchema } from "./sme-evidence.js";

/**
 * The PyME dashboard read model (`GET /my-campaigns`, Feature #434, WU1).
 *
 * The endpoint is `PYME`-only and its caller is always the verified principal:
 * the API scopes every read to that owner server-side, so no owner id, user id
 * or other caller-supplied identity ever crosses this boundary. Every fact here
 * comes from a persisted mirror — the campaign's reconciled state, its
 * contributions, its distributions and the PyME's declared sales — never a
 * client assumption. Aggregation is deterministic and server-side; the AI
 * computes nothing here.
 *
 * Money is integer ARS or a canonical seven-decimal XLM string (1 XLM =
 * 10,000,000 stroops), never a JSON float: a JavaScript number cannot carry a
 * stroop count exactly above 2^53. `null` (the honest "sin dato") is never a
 * fabricated zero — a missing distribution amount, a `missing` sales month or a
 * campaign without an FX snapshot all stay `null`.
 *
 * No PII crosses the wire: no owner id, no CUIT, no email, no document path.
 * `imageUrl` reuses the exact API-relative campaign-image rule of the
 * marketplace, so a storage object path or an absolute URL can never satisfy it.
 */

/**
 * The campaign's lifecycle, reusing the portfolio/detail vocabulary
 * (`portfolioPositionStatusSchema`): `funding` -> "Fondeo abierto", `settled` ->
 * "Meta alcanzada", `refunding` -> "Reembolso disponible". It is derived
 * server-side from the persisted campaign mirror, never from the request.
 */
export const myCampaignStateSchema = z.enum(["funding", "settled", "refunding"]);

export type MyCampaignState = z.infer<typeof myCampaignStateSchema>;

/** The persisted distribution's own state machine; only `confirmed` moved money. */
export const myCampaignDistributionStateSchema = z.enum(["submitted", "confirmed", "failed"]);

export type MyCampaignDistributionState = z.infer<typeof myCampaignDistributionStateSchema>;

/** The declared-sales status, mirroring `business_sales_period.status`. */
export const myCampaignSalesStatusSchema = z.enum(["reported", "missing", "anomalous"]);

export type MyCampaignSalesStatus = z.infer<typeof myCampaignSalesStatusSchema>;

/**
 * One distribution the campaign paid out (its recipients aggregated). Both
 * money fields are `null` when unavailable — a distribution recorded before the
 * campaign link existed carries no period, and a campaign with no FX snapshot
 * cannot express its XLM in ARS. The ARS figure is the XLM amount converted
 * through the campaign's own rate snapshot, the same synthetic conversion the
 * portfolio uses; it is never fabricated.
 */
export const myCampaignDistributionSchema = z.strictObject({
  distributionId: revenueShareDistributionIdSchema,
  /** The settled `YYYY-MM`; `null` for a legacy distribution. */
  period: periodSchema.nullable(),
  amountArs: z.number().int().nonnegative().nullable(),
  amountXlm: xlmAmountSchema.nullable(),
  state: myCampaignDistributionStateSchema
});

export type MyCampaignDistribution = z.infer<typeof myCampaignDistributionSchema>;

/**
 * One declared-sales month of the campaign's PyME. `salesArs` is `null` exactly
 * for a `missing` month — an absence, never a zero.
 */
export const myCampaignSalesMonthSchema = z.strictObject({
  period: periodSchema,
  salesArs: z.number().int().nonnegative().nullable(),
  status: myCampaignSalesStatusSchema
});

export type MyCampaignSalesMonth = z.infer<typeof myCampaignSalesMonthSchema>;

/** One campaign the caller owns, with its dashboard fields. */
export const myCampaignSchema = z.strictObject({
  campaignId: campaignIdSchema,
  name: z.string().trim().min(1),
  sector: z.string().trim().min(1),
  city: z.string().trim().min(1),
  imageUrl: marketplaceCampaignImageUrlSchema.nullable(),
  vaultAddress: stellarContractIdSchema,
  state: myCampaignStateSchema,
  goalArs: z.number().int().nonnegative(),
  /** The raised total in ARS, or `null` when the campaign predates its snapshot. */
  raisedArs: z.number().int().nonnegative().nullable(),
  fundedPercentBps: z.number().int().min(0).max(10_000),
  deadline: z.iso.datetime({ offset: true }),
  contributorsCount: z.number().int().nonnegative(),
  distributions: z.array(myCampaignDistributionSchema),
  sales: z.array(myCampaignSalesMonthSchema)
});

export type MyCampaign = z.infer<typeof myCampaignSchema>;

/** `GET /my-campaigns` response: every campaign the caller owns. */
export const myCampaignsSchema = z.strictObject({
  campaigns: z.array(myCampaignSchema)
});

export type MyCampaigns = z.infer<typeof myCampaignsSchema>;

export function parseMyCampaigns(input: unknown): MyCampaigns {
  return myCampaignsSchema.parse(input);
}

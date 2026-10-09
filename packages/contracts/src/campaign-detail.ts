import { z } from "zod";
import { campaignIdSchema } from "./campaign.js";
import { marketplaceCampaignImageUrlSchema, riskBandSchema } from "./marketplace.js";

/**
 * The account-gated campaign detail (`GET /marketplace/campaigns/:campaignId`,
 * Feature #422, work unit WU1).
 *
 * Opening a campaign's detail requires a session (any role), and only a
 * **published** campaign is visible — the same definition as the #414
 * marketplace listing (`campaign_deployment.state = 'confirmed'` on an
 * `open` campaign). An unpublished or unknown campaign is a `404`, so the
 * contract only ever describes a row the listing would also show.
 *
 * No PII crosses the wire: no owner id, no CUIT, no email, no document path.
 * Fields the template renders but the demo does not persist (tagline, employee
 * count, the percentage "usos de fondos", a vault address when it was never
 * stored) are `null` — the honest "sin dato" — never invented and never a
 * fabricated zero. `raisedArs` is `null` when the campaign predates its FX
 * snapshot; `imageUrl` follows the exact API-relative rule of the listing.
 */

/**
 * The derived lifecycle status the detail renders. It reuses the campaign
 * vocabulary the web already owns (`apps/web/src/application/evidence/
 * evidence-timeline.ts`): `funding` -> "Fondeo abierto", `settled` ->
 * "Meta alcanzada", `refunding` -> "Reembolso disponible". The API derives it
 * from the persisted campaign mirror (state + deadline + goal), never from the
 * request.
 */
export const campaignDetailStatusSchema = z.enum(["funding", "settled", "refunding"]);

export type CampaignDetailStatus = z.infer<typeof campaignDetailStatusSchema>;

/**
 * The persisted AI assessment, shaped for the "Recomendación de IA" section.
 * `reasons` are the assessment's claim strings (the evidence references are not
 * a public wire field). Present only when the application has an assessment;
 * `null` otherwise, matching the honest "sin dato".
 */
export const campaignDetailAssessmentSchema = z.strictObject({
  riskBand: riskBandSchema,
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string().trim().min(1)).min(1),
  model: z.string().trim().min(1),
  generatedAt: z.iso.datetime({ offset: true })
});

export type CampaignDetailAssessment = z.infer<typeof campaignDetailAssessmentSchema>;

/**
 * The latest recorded human decision for the application, shaped for the
 * "Decisión humana" section. A published campaign was approved, so the outcome
 * is implied and not repeated; only the attribution, the reason, the approved
 * limit and the server date travel.
 */
export const campaignDetailDecisionSchema = z.strictObject({
  actor: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  approvedLimitArs: z.number().int().nonnegative().nullable(),
  recordedAt: z.iso.datetime({ offset: true })
});

export type CampaignDetailDecision = z.infer<typeof campaignDetailDecisionSchema>;

export const campaignDetailSchema = z.strictObject({
  campaignId: campaignIdSchema,
  name: z.string().trim().min(1),
  sector: z.string().trim().min(1),
  city: z.string().trim().min(1),
  /** `businesses.description`, the "Sobre la PyME" copy. */
  description: z.string().trim().min(1),
  /** `businesses.created_at`, the "Desde" date. */
  foundedAt: z.iso.datetime({ offset: true }),
  goalArs: z.number().int().nonnegative(),
  raisedArs: z.number().int().nonnegative().nullable(),
  fundedPercentBps: z.number().int().min(0).max(10_000),
  /** The revenue-share percent the PyME offers, from `businesses.revenue_share`. */
  revenueShare: z.number().min(0),
  riskBand: riskBandSchema.nullable(),
  riskConfidence: z.number().min(0).max(1).nullable(),
  /** The campaign's deadline, from `campaign.deadline`. */
  closeDate: z.iso.datetime({ offset: true }),
  imageUrl: marketplaceCampaignImageUrlSchema.nullable(),
  status: campaignDetailStatusSchema,
  /** How many distinct investors have contributed, from `campaign_contribution`. */
  backers: z.number().int().nonnegative(),
  /**
   * The persisted vault contract id (`campaign.contract_address`). `null` when
   * the campaign carries none — never a fabricated value.
   */
  vaultAddress: z.string().trim().min(1).nullable(),
  assessment: campaignDetailAssessmentSchema.nullable(),
  decision: campaignDetailDecisionSchema.nullable()
});

export type CampaignDetail = z.infer<typeof campaignDetailSchema>;

export function parseCampaignDetail(input: unknown): CampaignDetail {
  return campaignDetailSchema.parse(input);
}

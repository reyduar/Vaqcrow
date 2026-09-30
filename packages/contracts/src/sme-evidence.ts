import { z } from "zod";
import { applicationIdSchema } from "./application-id.js";

/** Period in `YYYY-MM` form, month 01-12. */
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** Every synthetic datum carries the simulated label with it. */
export const simuladoLabelSchema = z.literal("SIMULADO");

/** Opaque, non-empty pointer to a piece of evidence (e.g. `sales:2026-01`). */
export const evidenceReferenceSchema = z.string().min(1);

export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;

export const salesPeriodStatusSchema = z.enum(["reported", "missing", "anomalous"]);

export type SalesPeriodStatus = z.infer<typeof salesPeriodStatusSchema>;

export const salesPeriodSchema = z.strictObject({
  period: periodSchema,
  // null (never 0) when the figure is not available.
  amountArs: z.number().nonnegative().nullable(),
  status: salesPeriodStatusSchema,
  /**
   * Per-datum provenance (DEMO.md §5: "Serie mensual de ventas con procedencia
   * por dato"). Additive and optional so pre-existing strict consumers — the
   * web parsers, `toAssessmentEvidence`'s five-field projection and the AI
   * evidence bundle — stay valid untouched; the sales-feed provider always
   * populates it, and optionality exists only for legacy payloads.
   */
  provenance: z.string().min(1).optional(),
  evidenceRef: evidenceReferenceSchema,
  simuladoLabel: simuladoLabelSchema
});

export type SalesPeriodContract = z.infer<typeof salesPeriodSchema>;

export const smeRequestSchema = z
  .strictObject({
    smeReference: z.string().min(1),
    declaredTotalArs: z.number().nonnegative(),
    periodStart: periodSchema,
    periodEnd: periodSchema,
    simuladoLabel: simuladoLabelSchema
  })
  .refine((request) => request.periodStart <= request.periodEnd, {
    message: "periodEnd must not be before periodStart",
    path: ["periodEnd"]
  });

export type SmeRequest = z.infer<typeof smeRequestSchema>;

/**
 * `POST /sme-requests` response: the server-generated application id (the root
 * identifier of the whole demo journey) with the request as persisted.
 */
export const smeRequestSubmissionSchema = z.strictObject({
  applicationId: applicationIdSchema,
  request: smeRequestSchema
});

export type SmeRequestSubmission = z.infer<typeof smeRequestSubmissionSchema>;

/** `GET /sme-requests/:applicationId` response: the request and its sales series. */
export const smeRequestReadSchema = z.strictObject({
  request: smeRequestSchema,
  salesPeriods: z.array(salesPeriodSchema)
});

export type SmeRequestRead = z.infer<typeof smeRequestReadSchema>;

export const reviewFindingKindSchema = z.enum(["missing", "anomalous", "contradictory"]);

export type ReviewFindingKind = z.infer<typeof reviewFindingKindSchema>;

export const reviewFindingSchema = z.strictObject({
  kind: reviewFindingKindSchema,
  period: periodSchema.optional(),
  evidenceRef: evidenceReferenceSchema.optional(),
  messageKey: z.string().min(1)
});

export type ReviewFinding = z.infer<typeof reviewFindingSchema>;

export function parseSalesPeriod(input: unknown): SalesPeriodContract {
  return salesPeriodSchema.parse(input);
}

export function parseSmeRequest(input: unknown): SmeRequest {
  return smeRequestSchema.parse(input);
}

export function parseReviewFinding(input: unknown): ReviewFinding {
  return reviewFindingSchema.parse(input);
}

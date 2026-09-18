import { z } from "zod";

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

import { evidenceReferenceSchema } from "@vaqcrow/contracts";
import { z } from "zod";

/**
 * Structured, schema-validated AI assessment contract (docs/planning/DEMO.md §5).
 *
 * This module owns the *shape* of a model response and the guardrails that a
 * response must satisfy before any human sees it. It deliberately contains no
 * provider, no network and no business calculation: the model recommends, a
 * human decides. Amounts, percentages, rounding and distribution are
 * deterministic rules that live outside the model and outside this contract.
 *
 * It lives in `packages/ai` because `docs/architecture/monorepo.md` assigns
 * "validar salidas estructuradas" to this package, and because the assessment
 * JSON is the *model's* output contract, not the contract between apps/web and
 * apps/api. The shared evidence-reference vocabulary it cites is imported from
 * `packages/contracts`, which stays the portable, consumer-facing schema layer.
 */

/**
 * Opaque assessment identifier in the `asm_` namespace (e.g. `asm_demo_001`).
 * The prefix keeps a model-authored identifier from ever colliding with the
 * backend-owned entity ids (`ApplicationId`, `FundingIntentId`, ...), which are
 * branded UUIDv4 values rather than model output.
 */
export const assessmentIdSchema = z
  .string()
  .regex(/^asm_[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/);

export type AssessmentId = z.infer<typeof assessmentIdSchema>;

export const assessmentRiskBandSchema = z.enum(["low", "medium", "high"]);

export type AssessmentRiskBand = z.infer<typeof assessmentRiskBandSchema>;

/**
 * Anomaly vocabulary, closed on purpose: an unrecognised kind is a malformed
 * response, not a new finding. `outlier` is the kind the demo documents.
 */
export const assessmentAnomalyTypeSchema = z.enum(["outlier", "contradiction"]);

export type AssessmentAnomalyType = z.infer<typeof assessmentAnomalyTypeSchema>;

export const assessmentAnomalySeveritySchema = z.enum(["info", "review"]);

export type AssessmentAnomalySeverity = z.infer<typeof assessmentAnomalySeveritySchema>;

/**
 * A claim is only admissible when it cites at least one supplied evidence
 * reference. A reason with no citation is a fact the model invented, which
 * docs/planning/DEMO.md §5 guardrails forbid.
 */
export const assessmentReasonSchema = z.strictObject({
  claim: z.string().trim().min(1).max(500),
  evidenceRefs: z.array(evidenceReferenceSchema).min(1)
});

export type AssessmentReason = z.infer<typeof assessmentReasonSchema>;

export const assessmentAnomalySchema = z.strictObject({
  type: assessmentAnomalyTypeSchema,
  evidenceRef: evidenceReferenceSchema,
  severity: assessmentAnomalySeveritySchema
});

export type AssessmentAnomaly = z.infer<typeof assessmentAnomalySchema>;

/**
 * The action set is closed to human review. The model cannot recommend
 * approval or rejection, cannot sign and cannot move funds: those are human
 * decisions recorded elsewhere.
 */
export const assessmentRecommendedActionSchema = z.enum(["human_review"]);

export type AssessmentRecommendedAction = z.infer<typeof assessmentRecommendedActionSchema>;

/**
 * `strictObject` is the first guardrail: unknown fields — including anything
 * shaped like a tool call or an instruction channel — are rejected outright, so
 * free text can never smuggle an executable request through the response.
 */
export const aiAssessmentSchema = z.strictObject({
  assessmentId: assessmentIdSchema,
  riskBand: assessmentRiskBandSchema,
  confidence: z.number().min(0).max(1),
  reasons: z.array(assessmentReasonSchema).min(1),
  anomalies: z.array(assessmentAnomalySchema),
  missingData: z.array(z.string().trim().min(1).max(300)),
  recommendedAction: assessmentRecommendedActionSchema,
  questions: z.array(z.string().trim().min(1).max(300))
});

export type AiAssessment = z.infer<typeof aiAssessmentSchema>;

export function parseAiAssessment(input: unknown): AiAssessment {
  return aiAssessmentSchema.parse(input);
}

/**
 * A citation that the supplied evidence does not contain. `path` locates the
 * offending field (`reasons.0`, `anomalies.1`) so the reason for rejection is
 * auditable instead of opaque.
 */
export type AssessmentEvidenceViolation = {
  readonly code: "unknown_evidence_reference";
  readonly reference: string;
  readonly path: string;
};

export type AssessmentEvidenceValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly violations: readonly AssessmentEvidenceViolation[] };

/**
 * Second guardrail: every cited reference must exist in the evidence that was
 * actually supplied to the model. The shape being valid is not enough — the
 * references have to resolve, otherwise the model is citing data it never saw.
 *
 * Returns every violation rather than the first, so the caller can surface the
 * whole rejection. A `{ ok: false }` result routes to manual review; it never
 * becomes an automatic approval.
 */
export function validateAssessmentEvidence(
  assessment: AiAssessment,
  suppliedReferences: readonly string[]
): AssessmentEvidenceValidation {
  const supplied = new Set(suppliedReferences);
  const violations: AssessmentEvidenceViolation[] = [];

  assessment.reasons.forEach((reason, index) => {
    for (const reference of reason.evidenceRefs) {
      if (!supplied.has(reference)) {
        violations.push({
          code: "unknown_evidence_reference",
          reference,
          path: `reasons.${index}`
        });
      }
    }
  });

  assessment.anomalies.forEach((anomaly, index) => {
    if (!supplied.has(anomaly.evidenceRef)) {
      violations.push({
        code: "unknown_evidence_reference",
        reference: anomaly.evidenceRef,
        path: `anomalies.${index}`
      });
    }
  });

  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}

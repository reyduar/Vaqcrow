import { z } from "zod";
import { applicationIdSchema } from "./application-id.js";
import { correlationIdSchema } from "./correlation-id.js";
import { reviewFindingSchema, salesPeriodSchema } from "./sme-evidence.js";

/**
 * The sanitized failure codes the AI assessment boundary is closed to. This
 * mirrors `packages/ai`'s `RunAssessmentError`; a value outside this set is not
 * a recognisable failure and must never be persisted as one. The handoff is a
 * durable record of a failure, never of a recommendation.
 */
export const assessmentFailureCodeSchema = z.enum([
  "timeout",
  "provider_unavailable",
  "invalid_output",
  "unknown_evidence_reference"
]);

export type AssessmentFailureCode = z.infer<typeof assessmentFailureCodeSchema>;

/**
 * The validated evidence bundle the failed assessment was run against. It
 * reuses the shared synthetic vocabulary so the persisted record carries
 * exactly the synthetic series and findings, marked `SIMULADO`. Declared here
 * rather than imported from `packages/ai`: contracts must not depend on the AI
 * package (the dependency already runs the other way), and the shape is the
 * same input boundary expressed over the same schemas.
 */
export const assessmentEvidenceBundleSchema = z.strictObject({
  periods: z.array(salesPeriodSchema).min(1),
  findings: z.array(reviewFindingSchema)
});

export type AssessmentHandoffEvidenceBundle = z.infer<typeof assessmentEvidenceBundleSchema>;

/**
 * Declared model provenance, present only when a valid one exists. A strict
 * object so a provider cannot smuggle a vendor trace into a durable record, and
 * optional because a timeout or an unavailable provider may have produced no
 * metadata to describe.
 */
export const assessmentProviderProvenanceSchema = z.strictObject({
  model: z.string().trim().min(1).max(120),
  promptVersion: z.string().trim().min(1).max(120),
  generatedAt: z.iso.datetime({ offset: true }),
  source: z.enum(["simulated", "provider"])
});

export type AssessmentProviderProvenance = z.infer<typeof assessmentProviderProvenanceSchema>;

/**
 * The complete, sanitized assessment-attempt handoff manual review reads.
 *
 * Strict at every level: raw provider output, vendor errors, secrets, PII,
 * seeds and arbitrary provenance metadata are rejected as unknown keys instead
 * of being silently dropped, so a caller cannot persist what it did not declare
 * and a boundary cannot quietly widen.
 */
export const assessmentFailureHandoffCommandSchema = z.strictObject({
  applicationId: applicationIdSchema,
  correlationId: correlationIdSchema,
  failureCode: assessmentFailureCodeSchema,
  evidence: assessmentEvidenceBundleSchema,
  providerProvenance: assessmentProviderProvenanceSchema.optional()
});

export type AssessmentFailureHandoffCommand = z.infer<typeof assessmentFailureHandoffCommandSchema>;

/**
 * The persisted record has the same sanitized shape as the command: replaying a
 * handoff returns the canonical stored values, not the submitted ones.
 */
export type AssessmentFailureHandoffRecord = AssessmentFailureHandoffCommand;

export function parseAssessmentFailureHandoffCommand(input: unknown): AssessmentFailureHandoffCommand {
  return assessmentFailureHandoffCommandSchema.parse(input);
}

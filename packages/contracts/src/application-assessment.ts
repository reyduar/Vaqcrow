import { z } from "zod";
import { correlationIdSchema } from "./correlation-id.js";
import { assessmentProviderProvenanceSchema } from "./assessment-failure-handoff.js";
import { evidenceReferenceSchema } from "./sme-evidence.js";

/**
 * The portable view of an application's persisted AI assessment (Feature #30,
 * Task #95 / T3a), consumed by `apps/web` and produced by `apps/api`.
 *
 * The model-output contract lives in `packages/ai` (`aiAssessmentSchema`), and
 * `packages/ai` depends on this package, so it cannot be imported here. This is
 * the deliberate consumer-facing mirror of that shape: the same closed fields,
 * strict at every level, so a response that drifted is an error the operator
 * sees. `apps/api` proves the two stay identical by parsing a real
 * `runAssessment` result through this schema.
 *
 * The recommendation set is closed to human review: the assessment never
 * approves, rejects, signs or moves funds. `metadata` reuses the declared
 * provenance shape (model, prompt version, generation time, source) so a
 * simulated assessment is always labelled as simulated.
 */
export const applicationAssessmentSchema = z.strictObject({
  assessmentId: z.string().regex(/^asm_[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/),
  riskBand: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  reasons: z
    .array(
      z.strictObject({
        claim: z.string().trim().min(1).max(500),
        evidenceRefs: z.array(evidenceReferenceSchema).min(1)
      })
    )
    .min(1),
  anomalies: z.array(
    z.strictObject({
      type: z.enum(["outlier", "contradiction"]),
      evidenceRef: evidenceReferenceSchema,
      severity: z.enum(["info", "review"])
    })
  ),
  missingData: z.array(z.string().trim().min(1).max(300)),
  recommendedAction: z.enum(["human_review"]),
  questions: z.array(z.string().trim().min(1).max(300))
});

export type ApplicationAssessment = z.infer<typeof applicationAssessmentSchema>;

/** `GET /application-reviews/:applicationId/assessment` response. */
export const applicationAssessmentReadSchema = z.strictObject({
  assessment: applicationAssessmentSchema,
  metadata: assessmentProviderProvenanceSchema,
  recordedAt: z.iso.datetime({ offset: true })
});

export type ApplicationAssessmentRead = z.infer<typeof applicationAssessmentReadSchema>;

export function parseApplicationAssessmentRead(input: unknown): ApplicationAssessmentRead {
  return applicationAssessmentReadSchema.parse(input);
}

/**
 * `POST /application-reviews/:applicationId/assessments` response when the
 * assessment succeeded: the persisted record plus the state it moved the
 * application to. `applied` is false on an idempotent replay of the same attempt.
 */
export const applicationAssessmentOutcomeSchema = applicationAssessmentReadSchema.extend({
  outcome: z.literal("assessment_recorded"),
  applicationState: z.literal("human_review"),
  applied: z.boolean(),
  correlationId: correlationIdSchema
});

export type ApplicationAssessmentOutcome = z.infer<typeof applicationAssessmentOutcomeSchema>;

import { z } from "zod";
import { applicationIdSchema } from "./application-id.js";
import { applicationReviewStateSchema } from "./application-review.js";
import {
  assessmentEvidenceBundleSchema,
  assessmentFailureCodeSchema,
  assessmentProviderProvenanceSchema
} from "./assessment-failure-handoff.js";

/**
 * The read view-model a browser consumes for an application whose failed AI
 * assessment was routed to human review.
 *
 * It carries only what the screen renders and nothing that could carry raw
 * provider diagnostics: the durable table has no column for them, and this
 * schema is strict at every level so a response that drifted is an error the
 * operator sees, never a half-rendered panel.
 *
 * `providerProvenance` stays optional because a timeout or an unavailable
 * provider may have produced no metadata to describe; when it is present its
 * `source` travels so a simulated record is labelled as simulated and never
 * presented as a real one.
 */
export const applicationManualReviewContextSchema = z.strictObject({
  applicationId: applicationIdSchema,
  applicationState: applicationReviewStateSchema,
  failureCode: assessmentFailureCodeSchema,
  evidence: assessmentEvidenceBundleSchema,
  providerProvenance: assessmentProviderProvenanceSchema.optional(),
  recordedAt: z.iso.datetime({ offset: true })
});

export type ApplicationManualReviewContext = z.infer<typeof applicationManualReviewContextSchema>;

export function parseApplicationManualReviewContext(input: unknown): ApplicationManualReviewContext {
  return applicationManualReviewContextSchema.parse(input);
}

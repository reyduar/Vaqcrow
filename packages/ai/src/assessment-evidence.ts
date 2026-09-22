import { reviewFindingSchema, salesPeriodSchema } from "@vaqcrow/contracts";
import { z } from "zod";

/**
 * The evidence a single assessment is allowed to see.
 *
 * This is the input boundary, not a prompt: it reuses the synthetic-series
 * vocabulary from `@vaqcrow/contracts` so that "only the supplied evidence is
 * sent" is a property of the type rather than a promise in a comment. Whatever
 * the provider returns may only cite references that appear here.
 */
export const assessmentEvidenceBundleSchema = z.strictObject({
  periods: z.array(salesPeriodSchema).min(1),
  findings: z.array(reviewFindingSchema)
});

export type AssessmentEvidenceBundle = z.infer<typeof assessmentEvidenceBundleSchema>;

export function parseAssessmentEvidenceBundle(input: unknown): AssessmentEvidenceBundle {
  return assessmentEvidenceBundleSchema.parse(input);
}

/**
 * The references the model is permitted to cite, derived from the bundle and
 * deduplicated. `findings[].evidenceRef` is optional in the shared contract, so
 * a finding without one contributes nothing rather than an empty reference.
 */
export function citableReferences(bundle: AssessmentEvidenceBundle): readonly string[] {
  const references = new Set<string>();

  for (const period of bundle.periods) {
    references.add(period.evidenceRef);
  }

  for (const finding of bundle.findings) {
    if (finding.evidenceRef !== undefined) {
      references.add(finding.evidenceRef);
    }
  }

  return [...references];
}

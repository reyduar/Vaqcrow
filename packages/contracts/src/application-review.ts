import { z } from "zod";
import { applicationIdSchema } from "./application-id.js";

export const applicationReviewStateSchema = z.enum([
  "draft",
  "awaiting_assessment",
  "human_review",
  "approved",
  "changes_requested",
  "rejected"
]);

export type ApplicationReviewState = z.infer<typeof applicationReviewStateSchema>;

export const applicationReviewSnapshotSchema = z.strictObject({
  applicationId: applicationIdSchema,
  state: applicationReviewStateSchema
});

export type ApplicationReviewSnapshot = z.infer<typeof applicationReviewSnapshotSchema>;

export function parseApplicationReviewSnapshot(input: unknown): ApplicationReviewSnapshot {
  return applicationReviewSnapshotSchema.parse(input);
}

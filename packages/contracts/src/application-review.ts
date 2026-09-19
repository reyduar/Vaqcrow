import { z } from "zod";
import { applicationIdSchema } from "./application-id.js";
import { correlationIdSchema } from "./correlation-id.js";
import { humanDecisionIdSchema } from "./human-decision-id.js";

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

export const humanDecisionOutcomeSchema = z.enum([
  "approved",
  "changes_requested",
  "rejected"
]);

export type HumanDecisionOutcome = z.infer<typeof humanDecisionOutcomeSchema>;

const humanDecisionCommandShape = {
  decisionId: humanDecisionIdSchema,
  applicationId: applicationIdSchema,
  outcome: humanDecisionOutcomeSchema,
  actor: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(1000),
  approvedLimitArs: z.int().positive().nullable()
};

function enforceApprovedLimitInvariant(
  value: { outcome: HumanDecisionOutcome; approvedLimitArs: number | null },
  context: z.RefinementCtx
): void {
  if (value.outcome === "approved" && value.approvedLimitArs === null) {
    context.addIssue({
      code: "custom",
      path: ["approvedLimitArs"],
      message: "An approved decision requires a positive safe integer limit"
    });
  }

  if (value.outcome !== "approved" && value.approvedLimitArs !== null) {
    context.addIssue({
      code: "custom",
      path: ["approvedLimitArs"],
      message: "Only an approved decision may include a limit"
    });
  }
}

export const humanDecisionCommandSchema = z
  .strictObject(humanDecisionCommandShape)
  .superRefine(enforceApprovedLimitInvariant);

export type HumanDecisionCommand = z.infer<typeof humanDecisionCommandSchema>;

export const humanDecisionRecordSchema = humanDecisionCommandSchema.safeExtend({
  decidedAt: z.iso.datetime({ offset: true }),
  correlationId: correlationIdSchema
});

export type HumanDecisionRecord = z.infer<typeof humanDecisionRecordSchema>;

export function parseHumanDecisionOutcome(input: unknown): HumanDecisionOutcome {
  return humanDecisionOutcomeSchema.parse(input);
}

export function parseHumanDecisionCommand(input: unknown): HumanDecisionCommand {
  return humanDecisionCommandSchema.parse(input);
}

export function parseHumanDecisionRecord(input: unknown): HumanDecisionRecord {
  return humanDecisionRecordSchema.parse(input);
}

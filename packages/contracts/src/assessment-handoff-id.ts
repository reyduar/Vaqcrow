import { z } from "zod";

/**
 * Caller-supplied idempotency key for an application-scoped assessment-failure
 * routing attempt (Feature #22, Task #71).
 *
 * It is the durable identity the failure handoff replays on. The atomic
 * `record_assessment_failure_handoff` RPC decides replay from the handoff's
 * stored correlation, so this key is written there: retrying the same attempt
 * with the same key replays the existing handoff, while a different key against
 * a durable handoff is an explicit conflict. It is deliberately a distinct
 * brand from `CorrelationId` so a transport request id can never be passed where
 * the durable attempt identity is required.
 */
export const assessmentHandoffIdSchema = z.uuidv4().brand<"AssessmentHandoffId">();

export type AssessmentHandoffId = z.infer<typeof assessmentHandoffIdSchema>;

export function parseAssessmentHandoffId(input: unknown): AssessmentHandoffId {
  return assessmentHandoffIdSchema.parse(input);
}

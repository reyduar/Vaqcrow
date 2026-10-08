import type { AssessmentHandoffId } from "@vaqcrow/contracts";
import { parseAssessmentHandoffId } from "@vaqcrow/contracts";
import { routeApplicationAssessment } from "../application/use-cases/route-application-assessment.js";
import type { RouteApplicationAssessmentDependencies } from "../application/use-cases/route-application-assessment.js";
import type { SubmissionAssessmentDependencies } from "../application/use-cases/submit-sme-request.js";

/**
 * The background assessment a real submission starts (U12, owner decision
 * 2026-10-08, option a). It runs the same application-scoped use case as
 * `POST /application-reviews/:applicationId/assessments` — same evidence
 * derivation, same atomic record + `awaiting_assessment -> human_review`
 * transition, same failure handoff to manual review — so no assessment logic is
 * duplicated here.
 *
 * - **Attempt key.** The application id is the attempt's `handoffId`. It is a
 *   server-generated uuid v4, unique per application, so a duplicate trigger
 *   replays instead of spending a second provider call, and a manual call with
 *   the same key replays the stored record (200). A manual call with any other
 *   key gets the route's existing `409 correlation_conflict`; the route itself
 *   is unchanged.
 * - **Correlation.** The submission's transport correlation (its request id),
 *   the same kind of value the route passes: traceability only.
 * - **Actor.** None: the assessment use case records no actor, so a
 *   system-triggered run impersonates nobody. The human decision that follows is
 *   still attributed to the authenticated admin.
 * - **Logging.** A non-routed outcome is logged with its closed-set code only;
 *   an unexpected throw is logged as `unexpected`, never with its message (it
 *   could echo provider details). Fastify's logger is disabled, so this follows
 *   the adapters' `console` convention.
 */

export interface SubmissionAssessmentFailureEvent {
  readonly event: "submission_assessment_failed";
  readonly applicationId: string;
  readonly correlationId: string;
  readonly code: string;
}

export type SubmissionAssessmentLog = (event: SubmissionAssessmentFailureEvent) => void;

const consoleLog: SubmissionAssessmentLog = (event) => {
  // eslint-disable-next-line no-console -- internal diagnostics only; sanitized codes, never messages
  console.warn("[SubmissionAssessment] assessment did not complete", event);
};

export function createSubmissionAssessment(
  dependencies: RouteApplicationAssessmentDependencies,
  log: SubmissionAssessmentLog = consoleLog
): SubmissionAssessmentDependencies {
  return {
    onSubmitted: async ({ applicationId, correlationId }) => {
      const failed = (code: string): void => {
        log({ event: "submission_assessment_failed", applicationId, correlationId, code });
      };

      try {
        // The application id is a uuid v4 (server-generated), so it is a valid
        // handoff id by construction; parsing keeps the brand honest.
        const handoffId: AssessmentHandoffId = parseAssessmentHandoffId(applicationId);
        const result = await routeApplicationAssessment(dependencies, {
          applicationId,
          handoffId,
          correlationId
        });

        if (!result.ok) {
          failed(result.error.code);
        }
      } catch {
        failed("unexpected");
      }
    }
  };
}

import { runAssessment } from "@vaqcrow/ai";
import type {
  AiAssessment,
  AssessmentEvidenceBundle,
  AssessmentMetadata,
  AssessmentProviderPort
} from "@vaqcrow/ai";
import { parseAssessmentFailureHandoffCommand, parseCorrelationId } from "@vaqcrow/contracts";
import type {
  ApplicationId,
  ApplicationReviewState,
  AssessmentFailureCode,
  AssessmentHandoffId,
  CorrelationId
} from "@vaqcrow/contracts";
import type {
  ApplicationReviewRepositoryError,
  ApplicationReviewRepositoryPort
} from "../ports/application-review-repository-port.js";

/**
 * Routes a failed assessment to truthful manual review (Feature #22, Task #71).
 *
 * The orchestration reuses the AI package's provider-independent
 * `runAssessment` — no reimplementation, no provider SDK, no credential. On any
 * closed-set failure the sanitized handoff is persisted FIRST (it is only
 * admissible while the application still awaits its assessment) and the
 * `awaiting_assessment -> human_review` transition follows. The failure path
 * never returns an assessment, a recommendation or an approval.
 *
 * `@vaqcrow/ai` is provider-independent workspace code, not an LLM SDK, so
 * importing it here keeps `application/` free of the packages
 * `api-application-stays-provider-free` forbids (Fastify, Supabase, Stellar and
 * provider SDKs). The provider itself always arrives through the dependencies,
 * never from a request.
 */

export type RouteAssessmentFailureErrorCode =
  | "not_found"
  | "state_conflict"
  | "correlation_conflict"
  | "unavailable";

export type RouteAssessmentFailureError =
  | { readonly code: "not_found" | "correlation_conflict" | "unavailable" }
  | { readonly code: "state_conflict"; readonly actualState: ApplicationReviewState };

/**
 * The label the operator reads when a failure was handed to a person. It says
 * manual review is required; it carries no model recommendation and no decision.
 *
 * `inputsPreserved` is true only when a handoff is durable for this attempt —
 * this call wrote it, or a same-key retry replayed it. The already-in-manual-
 * review case with no handoff reports false: nothing was preserved by it.
 */
export interface ManualReviewRouting {
  readonly outcome: "manual_review";
  readonly manualReviewRequired: true;
  readonly inputsPreserved: boolean;
  readonly applicationState: "human_review";
  readonly failureCode: AssessmentFailureCode;
  /**
   * The durable handoff state for this attempt, the explicit discriminator
   * between "routed now" and "already in manual review, inputs not preserved by
   * this attempt":
   * - `persisted`: this call wrote the handoff.
   * - `replayed`: a same-key retry found the durable handoff (crash recovery).
   * - `absent`: the application was already in `human_review` and no handoff
   *   exists for it, so this attempt preserved nothing.
   */
  readonly handoff: "persisted" | "replayed" | "absent";
  readonly correlationId: CorrelationId;
  // true = this call performed the transition; false = it was already applied.
  readonly applied: boolean;
}

/**
 * A successful, advisory assessment. It is returned untouched and the
 * application is NOT transitioned: a valid evaluation never moves to
 * `human_review` here. Persisting and presenting a successful assessment is a
 * later Feature; this unit only guarantees the no-transition invariant.
 */
export interface AdvisoryAssessmentOutcome {
  readonly outcome: "assessment_available";
  readonly routed: false;
  readonly assessment: AiAssessment;
  readonly metadata: AssessmentMetadata;
}

export type RouteAssessmentFailureResult =
  | { readonly ok: true; readonly value: ManualReviewRouting | AdvisoryAssessmentOutcome }
  | { readonly ok: false; readonly error: RouteAssessmentFailureError };

export interface RouteAssessmentFailureDependencies {
  readonly repository: Pick<
    ApplicationReviewRepositoryPort,
    "findById" | "recordAssessmentFailureHandoff" | "transition"
  >;
  readonly provider: AssessmentProviderPort;
  /** The bound for this call, from validated configuration — never from the request. */
  readonly timeoutMs: number;
}

export interface RouteAssessmentFailureInput {
  readonly applicationId: ApplicationId;
  readonly evidence: AssessmentEvidenceBundle;
  /**
   * Caller-supplied idempotency key: the durable identity this attempt's handoff
   * replays on. It is stored as the handoff's correlation because that is the
   * column the atomic RPC decides replay from.
   */
  readonly handoffId: AssessmentHandoffId;
  /** Transport correlation for traceability (the request id). It never decides replay. */
  readonly correlationId: CorrelationId;
}

export async function routeAssessmentFailureToManualReview(
  dependencies: RouteAssessmentFailureDependencies,
  input: RouteAssessmentFailureInput
): Promise<RouteAssessmentFailureResult> {
  const assessment = await runAssessment(dependencies.provider, {
    evidence: input.evidence,
    timeoutMs: dependencies.timeoutMs
  });

  if (assessment.ok) {
    return {
      ok: true,
      value: {
        outcome: "assessment_available",
        routed: false,
        assessment: assessment.value.assessment,
        metadata: assessment.value.metadata
      }
    };
  }

  const failureCode = assessment.error.code;

  let command;
  try {
    // Strict at every level: raw provider output or a vendor error has no field
    // to travel in. The route already validated the evidence and the ids, so a
    // failure here is a boundary defect, not caller input.
    command = parseAssessmentFailureHandoffCommand({
      applicationId: input.applicationId,
      // The handoff's stored correlation is the caller's idempotency key: the RPC
      // replays on that column, so the key — not the transport request id — is
      // written there. Both are the same uuid contract, re-branded here.
      correlationId: parseCorrelationId(input.handoffId),
      failureCode,
      evidence: input.evidence
    });
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }

  const handoff = await dependencies.repository.recordAssessmentFailureHandoff(command);

  if (!handoff.ok) {
    return resolveHandoffError(dependencies.repository, input, failureCode, handoff.error);
  }

  const transition = await dependencies.repository.transition({
    applicationId: input.applicationId,
    from: "awaiting_assessment",
    to: "human_review",
    correlationId: input.correlationId
  });

  if (!transition.ok) {
    return { ok: false, error: transitionError(transition.error) };
  }

  return {
    ok: true,
    value: {
      outcome: "manual_review",
      manualReviewRequired: true,
      inputsPreserved: true,
      applicationState: "human_review",
      // On a replay the stored record is canonical: report the failure code the
      // original attempt persisted, not the live one from this call.
      failureCode: handoff.value.applied ? failureCode : handoff.value.record.failureCode,
      handoff: handoff.value.applied ? "persisted" : "replayed",
      correlationId: input.correlationId,
      // The transition is the state-changing step, so it decides `applied`.
      applied: transition.value.applied
    }
  };
}

/**
 * The handoff is only admissible while the application awaits its assessment.
 *
 * The atomic RPC decides in this order: an existing handoff row is `replayed`
 * (same correlation) or `correlation_conflict` (different correlation); only
 * when no row exists does it read the application state and return
 * `state_conflict`. So a `state_conflict` here proves **no handoff row exists**
 * for this application: an application already in `human_review` has no durable
 * handoff, its inputs were NOT preserved by this attempt, and the result says so
 * (`inputsPreserved: false`, `handoff: "absent"`). This state is reachable —
 * `supabase/seed/demo-application.sql` inserts the demo application directly in
 * `human_review`, and no other production path creates that state.
 *
 * The state is read with `findById` rather than by widening the transition
 * rules: `human_review` is resolved as idempotent success while every other
 * source state stays an explicit conflict reported with the state the
 * application actually holds.
 */
async function resolveHandoffError(
  repository: RouteAssessmentFailureDependencies["repository"],
  input: RouteAssessmentFailureInput,
  failureCode: AssessmentFailureCode,
  error: ApplicationReviewRepositoryError
): Promise<RouteAssessmentFailureResult> {
  if (error.code === "not_found") {
    return { ok: false, error: { code: "not_found" } };
  }

  if (error.code === "correlation_conflict") {
    return { ok: false, error: { code: "correlation_conflict" } };
  }

  if (error.code !== "state_conflict") {
    // idempotency_conflict / already_exists / invalid_state / unavailable: not a
    // routing outcome this path can resolve, so it fails closed.
    return { ok: false, error: { code: "unavailable" } };
  }

  const current = await repository.findById(input.applicationId);

  if (!current.ok) {
    return {
      ok: false,
      error: { code: current.error.code === "not_found" ? "not_found" : "unavailable" }
    };
  }

  if (current.value.state === "human_review") {
    return {
      ok: true,
      value: {
        outcome: "manual_review",
        manualReviewRequired: true,
        // No handoff row exists for this attempt (see above), so nothing was
        // preserved by it; the live failure code is the only one available.
        inputsPreserved: false,
        applicationState: "human_review",
        failureCode,
        handoff: "absent",
        correlationId: input.correlationId,
        applied: false
      }
    };
  }

  return {
    ok: false,
    error: { code: "state_conflict", actualState: current.value.state }
  };
}

function transitionError(error: ApplicationReviewRepositoryError): RouteAssessmentFailureError {
  if (error.code === "not_found") {
    return { code: "not_found" };
  }

  if (error.code === "state_conflict" && error.actualState !== undefined) {
    return { code: "state_conflict", actualState: error.actualState };
  }

  return { code: "unavailable" };
}

import { parseAssessmentEvidenceBundle, runAssessment } from "@vaqcrow/ai";
import type { AssessmentEvidenceBundle, AssessmentProviderPort } from "@vaqcrow/ai";
import { parseAssessmentFailureHandoffCommand, parseCorrelationId } from "@vaqcrow/contracts";
import type {
  ApplicationAssessment,
  ApplicationId,
  ApplicationReviewState,
  AssessmentFailureCode,
  AssessmentHandoffId,
  AssessmentProviderProvenance,
  CorrelationId
} from "@vaqcrow/contracts";
import type { ApplicationAssessmentRepositoryPort } from "../ports/application-assessment-repository-port.js";
import type {
  ApplicationReviewRepositoryError,
  ApplicationReviewRepositoryPort
} from "../ports/application-review-repository-port.js";
import type { SalesDataProviderPort } from "../ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";

/**
 * Assesses an application and hands it to human review (Feature #22 Task #71,
 * Feature #30 Task #95 / T3a).
 *
 * The evidence is never client-supplied: it is derived here from the persisted
 * SME request and the sales periods the sales-data provider holds for its
 * `smeReference`. `findings` is empty because the logic that derives review
 * findings from a series (`apps/web` `application/evidence`) lives in the web
 * app, which the API may not import, and no shared package hosts it yet; the
 * bundle therefore carries exactly the factual series and nothing invented.
 * A request with no sales periods is not assessed at all (the bundle needs at
 * least one period and there is nothing to preserve for a manual reviewer):
 * it is the explicit `sales_evidence_missing` outcome and the application stays
 * in `awaiting_assessment`.
 *
 * A successful assessment is persisted together with the
 * `awaiting_assessment -> human_review` transition in one atomic repository
 * command, keyed by the caller's `handoffId` so a retry replays the stored
 * record. A failed one is routed to truthful manual review as before.
 *
 * The failure orchestration reuses the AI package's provider-independent
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

export type RouteApplicationAssessmentError =
  | {
      readonly code:
        | "not_found"
        | "correlation_conflict"
        | "sales_evidence_missing"
        | "unavailable";
    }
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
 * A successful assessment, as persisted. The application is now in
 * `human_review`; the assessment is advisory input for that human, never a
 * decision. `applied` is false when the same attempt was already recorded and
 * the stored record is returned.
 */
export interface RecordedAssessmentOutcome {
  readonly outcome: "assessment_recorded";
  readonly applicationState: "human_review";
  readonly applied: boolean;
  readonly correlationId: CorrelationId;
  readonly assessment: ApplicationAssessment;
  readonly metadata: AssessmentProviderProvenance;
  readonly recordedAt: string;
}

export type RouteApplicationAssessmentResult =
  | { readonly ok: true; readonly value: ManualReviewRouting | RecordedAssessmentOutcome }
  | { readonly ok: false; readonly error: RouteApplicationAssessmentError };

export interface RouteApplicationAssessmentDependencies {
  readonly repository: Pick<
    ApplicationReviewRepositoryPort,
    "findById" | "recordAssessmentFailureHandoff" | "transition"
  >;
  readonly assessments: Pick<ApplicationAssessmentRepositoryPort, "record" | "findStoredByApplicationId">;
  readonly smeRequests: Pick<SmeRequestRepositoryPort, "findByApplicationId">;
  readonly salesData: Pick<SalesDataProviderPort, "getPeriods">;
  readonly provider: AssessmentProviderPort;
  /** The bound for this call, from validated configuration — never from the request. */
  readonly timeoutMs: number;
}

export interface RouteApplicationAssessmentInput {
  readonly applicationId: ApplicationId;
  /**
   * Caller-supplied idempotency key of this attempt, for both outcomes: the
   * durable identity a recorded assessment (`attempt_id`) or a failure handoff
   * (its stored correlation, the column the atomic RPC decides replay from)
   * replays on.
   */
  readonly handoffId: AssessmentHandoffId;
  /** Transport correlation for traceability (the request id). It never decides replay. */
  readonly correlationId: CorrelationId;
}

export async function routeApplicationAssessment(
  dependencies: RouteApplicationAssessmentDependencies,
  rawInput: RouteApplicationAssessmentInput
): Promise<RouteApplicationAssessmentResult> {
  // A retry of an attempt that already recorded a success is a deterministic
  // replay: answer it from the stored record before loading evidence or spending
  // a provider call. The atomic RPC stays the backstop for a concurrent race.
  const stored = await dependencies.assessments.findStoredByApplicationId(rawInput.applicationId);

  if (stored.ok) {
    if (stored.value.attemptId !== rawInput.handoffId) {
      return { ok: false, error: { code: "correlation_conflict" } };
    }

    return {
      ok: true,
      value: {
        outcome: "assessment_recorded",
        applicationState: "human_review",
        applied: false,
        correlationId: rawInput.correlationId,
        assessment: stored.value.record.assessment,
        metadata: stored.value.record.metadata,
        recordedAt: stored.value.record.recordedAt
      }
    };
  }

  if (stored.error.code !== "not_found") {
    return { ok: false, error: { code: "unavailable" } };
  }

  const derived = await deriveEvidence(dependencies, rawInput.applicationId);

  if (!derived.ok) {
    return derived;
  }

  const input = { ...rawInput, evidence: derived.value };

  const assessment = await runAssessment(dependencies.provider, {
    evidence: input.evidence,
    timeoutMs: dependencies.timeoutMs
  });

  if (assessment.ok) {
    const recorded = await dependencies.assessments.record({
      applicationId: input.applicationId,
      attemptId: input.handoffId,
      correlationId: input.correlationId,
      assessment: assessment.value.assessment,
      metadata: assessment.value.metadata
    });

    if (!recorded.ok) {
      return { ok: false, error: assessmentRecordError(recorded.error) };
    }

    return {
      ok: true,
      value: {
        outcome: "assessment_recorded",
        applicationState: "human_review",
        applied: recorded.value.applied,
        correlationId: input.correlationId,
        // On a replay the stored record is canonical, not the live run.
        assessment: recorded.value.record.assessment,
        metadata: recorded.value.record.metadata,
        recordedAt: recorded.value.record.recordedAt
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

async function deriveEvidence(
  dependencies: RouteApplicationAssessmentDependencies,
  applicationId: ApplicationId
): Promise<
  | { readonly ok: true; readonly value: AssessmentEvidenceBundle }
  | { readonly ok: false; readonly error: RouteApplicationAssessmentError }
> {
  const found = await dependencies.smeRequests.findByApplicationId(applicationId);

  if (!found.ok) {
    return {
      ok: false,
      error: { code: found.error.code === "not_found" ? "not_found" : "unavailable" }
    };
  }

  const sales = await dependencies.salesData.getPeriods(found.value.request.smeReference);

  if (!sales.ok && sales.error.code !== "not_found") {
    return { ok: false, error: { code: "unavailable" } };
  }

  // A feed with no series for the reference is the same declared absence as an empty one.
  const periods = sales.ok ? sales.value : [];

  if (periods.length === 0) {
    return { ok: false, error: { code: "sales_evidence_missing" } };
  }

  try {
    return { ok: true, value: parseAssessmentEvidenceBundle({ periods, findings: [] }) };
  } catch {
    // The series comes from the provider port, not the caller: a malformed one is a defect.
    return { ok: false, error: { code: "unavailable" } };
  }
}

function assessmentRecordError(
  error: { readonly code: string; readonly actualState?: ApplicationReviewState }
): RouteApplicationAssessmentError {
  if (error.code === "not_found") {
    return { code: "not_found" };
  }

  if (error.code === "attempt_conflict") {
    // Same meaning as the failure path's competing correlation: another attempt
    // key already holds this application's durable record.
    return { code: "correlation_conflict" };
  }

  if (error.code === "state_conflict" && error.actualState !== undefined) {
    return { code: "state_conflict", actualState: error.actualState };
  }

  return { code: "unavailable" };
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
  repository: RouteApplicationAssessmentDependencies["repository"],
  input: RouteApplicationAssessmentInput,
  failureCode: AssessmentFailureCode,
  error: ApplicationReviewRepositoryError
): Promise<RouteApplicationAssessmentResult> {
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

function transitionError(error: ApplicationReviewRepositoryError): RouteApplicationAssessmentError {
  if (error.code === "not_found") {
    return { code: "not_found" };
  }

  if (error.code === "state_conflict" && error.actualState !== undefined) {
    return { code: "state_conflict", actualState: error.actualState };
  }

  return { code: "unavailable" };
}

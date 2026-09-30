import type {
  ApplicationAssessment,
  ApplicationAssessmentRead,
  ApplicationId,
  ApplicationReviewState,
  AssessmentHandoffId,
  AssessmentProviderProvenance,
  CorrelationId
} from "@vaqcrow/contracts";

export type ApplicationAssessmentRepositoryErrorCode =
  | "not_found"
  | "state_conflict"
  | "attempt_conflict"
  | "unavailable";

export interface ApplicationAssessmentRepositoryError {
  readonly code: ApplicationAssessmentRepositoryErrorCode;
  // Only populated for "state_conflict": the state the application actually holds.
  readonly actualState?: ApplicationReviewState;
}

export type ApplicationAssessmentRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApplicationAssessmentRepositoryError };

export interface ApplicationAssessmentRecordOutcome {
  readonly record: ApplicationAssessmentRead;
  // false = same-attempt replay: the originally stored record is returned.
  readonly applied: boolean;
}

export interface ApplicationAssessmentRepositoryPort {
  /**
   * Atomically stores the validated assessment and moves the application from
   * `awaiting_assessment` to `human_review`. The attempt id is the idempotency
   * key: the same attempt replays the stored record, a different attempt against
   * an already assessed application is `attempt_conflict`, an application in any
   * other state is `state_conflict` and an unknown one is `not_found`. Only the
   * validated assessment and sanitized metadata cross this boundary.
   */
  record(input: {
    applicationId: ApplicationId;
    attemptId: AssessmentHandoffId;
    correlationId: CorrelationId;
    assessment: ApplicationAssessment;
    metadata: AssessmentProviderProvenance;
  }): Promise<ApplicationAssessmentRepositoryResult<ApplicationAssessmentRecordOutcome>>;

  /** `not_found` means no assessment has been recorded for that application. */
  findByApplicationId(
    applicationId: ApplicationId
  ): Promise<ApplicationAssessmentRepositoryResult<ApplicationAssessmentRead>>;
}

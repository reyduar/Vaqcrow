import type {
  ApplicationId,
  ApplicationManualReviewContext,
  ApplicationReviewSnapshot,
  ApplicationReviewState,
  AssessmentFailureHandoffCommand,
  AssessmentFailureHandoffRecord,
  CorrelationId,
  HumanDecisionCommand,
  HumanDecisionRecord
} from "@vaqcrow/contracts";

export type ApplicationReviewRepositoryErrorCode =
  | "not_found"
  | "state_conflict"
  | "correlation_conflict"
  | "idempotency_conflict"
  | "already_exists"
  | "invalid_state"
  | "unavailable";

export interface ApplicationReviewRepositoryError {
  readonly code: ApplicationReviewRepositoryErrorCode;
  // Only populated for "state_conflict": the state the row actually holds.
  readonly actualState?: ApplicationReviewState;
}

export type ApplicationReviewRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApplicationReviewRepositoryError };

export interface ApplicationReviewTransitionOutcome {
  readonly snapshot: ApplicationReviewSnapshot;
  // false = idempotent replay: the transition had already been applied.
  readonly applied: boolean;
}

export interface HumanDecisionRepositoryOutcome {
  readonly record: HumanDecisionRecord;
  // false = exact decision-id replay; the original immutable row is returned.
  readonly applied: boolean;
}

export interface AssessmentFailureHandoffRepositoryOutcome {
  readonly record: AssessmentFailureHandoffRecord;
  // false = same-correlation replay; the original durable record is returned.
  readonly applied: boolean;
}

export interface ApplicationReviewRepositoryPort {
  create(input: {
    applicationId: ApplicationId;
    state: ApplicationReviewState;
    correlationId: CorrelationId;
  }): Promise<ApplicationReviewRepositoryResult<ApplicationReviewSnapshot>>;

  findById(applicationId: ApplicationId): Promise<ApplicationReviewRepositoryResult<ApplicationReviewSnapshot>>;

  transition(input: {
    applicationId: ApplicationId;
    from: ApplicationReviewState;
    to: ApplicationReviewState;
    correlationId: CorrelationId;
  }): Promise<ApplicationReviewRepositoryResult<ApplicationReviewTransitionOutcome>>;

  recordHumanDecision(input: {
    command: HumanDecisionCommand;
    correlationId: CorrelationId;
  }): Promise<ApplicationReviewRepositoryResult<HumanDecisionRepositoryOutcome>>;

  /**
   * Persists the sanitized assessment-failure handoff for an application that is
   * awaiting assessment. A same-correlation retry is a replay; a competing
   * correlation, an incompatible state or an unknown application is an explicit
   * conflict, never a second record. Only the sanitized command fields cross this
   * boundary — raw provider output or errors never do.
   */
  recordAssessmentFailureHandoff(
    command: AssessmentFailureHandoffCommand
  ): Promise<ApplicationReviewRepositoryResult<AssessmentFailureHandoffRepositoryOutcome>>;

  /**
   * Reads the persisted manual-review context for an application whose failed
   * assessment was routed to human review: the sanitized handoff plus the
   * application's current state. `not_found` means no handoff exists for that
   * application and is reported truthfully rather than as empty content. Only
   * the sanitized record fields cross this boundary; raw provider output or
   * errors never do.
   */
  readManualReviewContext(
    applicationId: ApplicationId
  ): Promise<ApplicationReviewRepositoryResult<ApplicationManualReviewContext>>;
}

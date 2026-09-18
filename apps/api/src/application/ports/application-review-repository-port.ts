import type { ApplicationId, ApplicationReviewSnapshot, ApplicationReviewState, CorrelationId } from "@vaqcrow/contracts";

export type ApplicationReviewRepositoryErrorCode =
  | "not_found"
  | "state_conflict"
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
}

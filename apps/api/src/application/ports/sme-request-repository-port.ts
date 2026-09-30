import type { ApplicationId, CorrelationId, SmeRequest } from "@vaqcrow/contracts";

export type SmeRequestRepositoryErrorCode = "not_found" | "invalid_request" | "unavailable";

export interface SmeRequestRepositoryError {
  readonly code: SmeRequestRepositoryErrorCode;
}

export type SmeRequestRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SmeRequestRepositoryError };

export interface SmeRequestRecord {
  readonly applicationId: ApplicationId;
  readonly request: SmeRequest;
}

export interface SmeRequestSubmissionOutcome extends SmeRequestRecord {
  // false = idempotent replay: the correlation id had already created this application.
  readonly applied: boolean;
}

export interface SmeRequestRepositoryPort {
  /**
   * Atomically creates the application (state `awaiting_assessment`) together
   * with its SME request. Replaying the same correlation id returns the
   * application it already created instead of creating a second one.
   */
  submit(input: {
    applicationId: ApplicationId;
    request: SmeRequest;
    correlationId: CorrelationId;
  }): Promise<SmeRequestRepositoryResult<SmeRequestSubmissionOutcome>>;

  /** `not_found` means no SME request exists for that application. */
  findByApplicationId(applicationId: ApplicationId): Promise<SmeRequestRepositoryResult<SmeRequestRecord>>;
}

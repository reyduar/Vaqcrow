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
  /**
   * The profile that submitted the request. Absent on rows that predate
   * per-row ownership (T3b) — a caller that is not the owner treats an absent
   * owner as "not yours".
   */
  readonly ownerUserId?: string;
}

export interface SmeRequestSubmissionOutcome extends SmeRequestRecord {
  // false = idempotent replay: the correlation id had already created this application.
  readonly applied: boolean;
}

export interface SmeRequestRepositoryPort {
  /**
   * Atomically creates the application (state `awaiting_assessment`) together
   * with its SME request, recording `ownerUserId` as the request's owner.
   * Replaying the same correlation id — or re-submitting identical owner and
   * declared content under a fresh correlation id — returns the application
   * already created instead of creating a second one. The owner+content check
   * runs inside the RPC transaction under an owner-scoped advisory lock, so it
   * holds under concurrent retries, not only sequential ones.
   */
  submit(input: {
    applicationId: ApplicationId;
    request: SmeRequest;
    correlationId: CorrelationId;
    /** The authenticated principal; never a client-supplied owner. */
    ownerUserId: string;
  }): Promise<SmeRequestRepositoryResult<SmeRequestSubmissionOutcome>>;

  /** `not_found` means no SME request exists for that application. */
  findByApplicationId(applicationId: ApplicationId): Promise<SmeRequestRepositoryResult<SmeRequestRecord>>;

  /**
   * The owner's own submitted requests, newest first; an empty array when the
   * owner has none. The submit use case reads this as a fast path for the common
   * sequential retry; the authoritative idempotency guard lives inside the
   * `submit_sme_request` RPC, which re-checks owner+content atomically under an
   * owner-scoped advisory lock (the RPC's correlation id is per-request, so on
   * its own it does not de-duplicate a client retry).
   */
  findByOwner(ownerUserId: string): Promise<SmeRequestRepositoryResult<readonly SmeRequestRecord[]>>;
}

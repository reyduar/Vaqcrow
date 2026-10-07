import type { ApplicationId, ApplicationReviewState, CorrelationId, SmeRequest } from "@vaqcrow/contracts";

export type SmeRequestRepositoryErrorCode = "not_found" | "invalid_request" | "unavailable";

/**
 * The honest value rendered for an application whose owner has no `businesses`
 * row (#386/T1). It is a declared absence, never an invented company name and
 * never a zero.
 */
export const MISSING_BUSINESS_LABEL = "Sin dato";

/** The queue row fields an operator may sort by (see `GET /sme-requests`). */
export type AdminQueueSortField = "applicationId" | "name" | "sector" | "state" | "updatedAt";

export type AdminQueueSortOrder = "asc" | "desc";

/**
 * A validated queue query (the use case owns validation and clamping; the port
 * receives already-resolved values). `search` is optional and pre-sanitized for
 * PostgREST's filter syntax.
 */
export interface AdminQueueQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: AdminQueueSortField;
  readonly order: AdminQueueSortOrder;
  readonly search?: string;
}

/** One PyME queue row: the application plus its company and review state. */
export interface AdminQueueItem {
  readonly applicationId: ApplicationId;
  readonly name: string;
  readonly sector: string;
  readonly state: ApplicationReviewState;
  readonly updatedAt: string;
}

export interface AdminQueuePage {
  readonly items: readonly AdminQueueItem[];
  readonly total: number;
}

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
   * Replaying the same correlation id returns the application it already
   * created instead of creating a second one.
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
   * The ADMIN-only PyMEs queue read model (#386/T1): every submitted application
   * with its company name, sector, review state and last change, joined and
   * paginated server-side. A missing company is mapped to
   * `MISSING_BUSINESS_LABEL`, never dropped or invented.
   */
  listAdminQueue(query: AdminQueueQuery): Promise<SmeRequestRepositoryResult<AdminQueuePage>>;
}

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
 * The four display groups the console's KPIs and table use (#386/T1b). They
 * fold the six raw `application_review` states into the states an operator
 * reads, so the `state` filter and the counts are resolved server-side and stay
 * global instead of being derived from the loaded page.
 */
export type AdminQueueDisplayState = "pending" | "changes" | "approved" | "rejected";

export const ADMIN_QUEUE_DISPLAY_STATES: readonly AdminQueueDisplayState[] = Object.freeze([
  "pending",
  "changes",
  "approved",
  "rejected"
]);

/**
 * Display group -> the raw `application_review` states it folds. `pending` is
 * every state not yet decided; the other three map one to one. Kept in lockstep
 * with `queueDisplayState` in `apps/web/src/application/admin/queue.ts`.
 */
export const ADMIN_QUEUE_RAW_STATES_BY_DISPLAY: Readonly<
  Record<AdminQueueDisplayState, readonly ApplicationReviewState[]>
> = Object.freeze({
  pending: Object.freeze(["awaiting_assessment", "human_review"] as const),
  changes: Object.freeze(["changes_requested"] as const),
  approved: Object.freeze(["approved"] as const),
  rejected: Object.freeze(["rejected"] as const)
});

/** One number per display group, global across the whole queue (never page-scoped). */
export type AdminQueueCounts = Readonly<Record<AdminQueueDisplayState, number>>;

/**
 * A validated queue query (the use case owns validation and clamping; the port
 * receives already-resolved values). `search` is optional and pre-sanitized for
 * PostgREST's filter syntax; `state` narrows the page to one display group.
 */
export interface AdminQueueQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: AdminQueueSortField;
  readonly order: AdminQueueSortOrder;
  readonly search?: string;
  readonly state?: AdminQueueDisplayState;
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
  /** The global per-display-group counts, independent of the requested page. */
  readonly counts: AdminQueueCounts;
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
   * The application's own `application_review` state (Feature #434, WU5),
   * read by `application_id`. `not_found` means no review row exists for that
   * application; the caller never invents a state. The `sme_request` table
   * carries no state, so this is the only honest source of it.
   */
  findReviewStateByApplicationId(
    applicationId: ApplicationId
  ): Promise<SmeRequestRepositoryResult<ApplicationReviewState>>;

  /**
   * The owner's own submitted requests, newest first; an empty array when the
   * owner has none. The submit use case reads this as a fast path for the common
   * sequential retry; the authoritative idempotency guard lives inside the
   * `submit_sme_request` RPC, which re-checks owner+content atomically under an
   * owner-scoped advisory lock (the RPC's correlation id is per-request, so on
   * its own it does not de-duplicate a client retry).
   */
  findByOwner(ownerUserId: string): Promise<SmeRequestRepositoryResult<readonly SmeRequestRecord[]>>;

  /**
   * The ADMIN-only PyMEs queue read model (#386/T1): every submitted application
   * with its company name, sector, review state and last change, joined and
   * paginated server-side. A missing company is mapped to
   * `MISSING_BUSINESS_LABEL`, never dropped or invented.
   */
  listAdminQueue(query: AdminQueueQuery): Promise<SmeRequestRepositoryResult<AdminQueuePage>>;
}

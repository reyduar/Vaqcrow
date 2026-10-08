import type { ApplicationReviewState } from "@vaqcrow/contracts";

/**
 * The admin PyMEs queue capability (Feature #386, Tasks T3 + T1b). Vendor-free
 * and React-free; the HTTP adapter lives in `infrastructure/admin/`.
 *
 * It mirrors `GET /sme-requests` (ADMIN-only): a server-side-paginated and
 * sorted page of every submitted application with its company name, sector,
 * review state and last change. A missing business arrives as the literal
 * `"Sin dato"` from the API — this boundary never invents a company or a zero.
 *
 * T1b adds a server-side `state` filter and a global `counts` object, so the
 * KPI numbers and the nav badge are no longer derived from the loaded page.
 */

export type AdminQueueSortField = "applicationId" | "name" | "sector" | "state" | "updatedAt";

export type AdminQueueSortOrder = "asc" | "desc";

/**
 * The four display groups the API filters and counts by. Kept in lockstep with
 * `QueueDisplayState` in `application/admin/queue.ts`.
 */
export type AdminQueueDisplayState = "pending" | "changes" | "approved" | "rejected";

export const ADMIN_QUEUE_DISPLAY_STATES: readonly AdminQueueDisplayState[] = Object.freeze([
  "pending",
  "changes",
  "approved",
  "rejected"
]);

/** One global number per display group, independent of the requested page. */
export type AdminQueueCounts = Readonly<Record<AdminQueueDisplayState, number>>;

export interface AdminQueueQuery {
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
  readonly sort: AdminQueueSortField;
  readonly order: AdminQueueSortOrder;
  /** Already-trimmed search term over name, id and sector; omitted when empty. */
  readonly search?: string;
  /** Narrows the page to one display group; omitted means every group. */
  readonly state?: AdminQueueDisplayState;
}

/** One queue row, exactly as `GET /sme-requests` returns it. */
export interface AdminQueueItem {
  readonly applicationId: string;
  readonly name: string;
  readonly sector: string;
  readonly state: ApplicationReviewState;
  readonly updatedAt: string;
}

export interface AdminQueuePage {
  readonly items: readonly AdminQueueItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  /** Global per-display-group counts; never derived from `items`. */
  readonly counts: AdminQueueCounts;
}

/**
 * Sanitized failure codes: the API's own `unavailable` envelope plus the
 * transport's `network`. The UI maps each to its own copy.
 */
export type AdminQueueErrorCode = "unavailable" | "network";

export const ADMIN_QUEUE_ERROR_CODES: readonly AdminQueueErrorCode[] = Object.freeze([
  "unavailable",
  "network"
]);

export type AdminQueueResult =
  | { readonly ok: true; readonly page: AdminQueuePage }
  | { readonly ok: false; readonly code: AdminQueueErrorCode };

export interface AdminQueuePort {
  list(query: AdminQueueQuery): Promise<AdminQueueResult>;
}

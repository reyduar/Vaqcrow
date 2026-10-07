import type { ApplicationReviewState } from "@vaqcrow/contracts";

/**
 * The admin PyMEs queue capability (Feature #386, Task T3). Vendor-free and
 * React-free; the HTTP adapter lives in `infrastructure/admin/`.
 *
 * It mirrors `GET /sme-requests` (T1, ADMIN-only): a server-side-paginated and
 * sorted page of every submitted application with its company name, sector,
 * review state and last change. A missing business arrives as the literal
 * `"Sin dato"` from the API — this boundary never invents a company or a zero.
 *
 * There is no per-state filter or per-state count in the T1 contract, so the
 * queue's KPI narrowing is a presentation concern over the loaded page (see
 * `application/admin/queue.ts`).
 */

export type AdminQueueSortField = "applicationId" | "name" | "sector" | "state" | "updatedAt";

export type AdminQueueSortOrder = "asc" | "desc";

export interface AdminQueueQuery {
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
  readonly sort: AdminQueueSortField;
  readonly order: AdminQueueSortOrder;
  /** Already-trimmed search term over name, id and sector; omitted when empty. */
  readonly search?: string;
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

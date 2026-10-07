import type { ApplicationReviewState } from "@vaqcrow/contracts";
import type { AdminQueueItem, AdminQueueQuery, AdminQueueSortField, AdminQueueSortOrder } from "@/application/ports/admin-queue-port";

/**
 * Pure model of the admin PyMEs queue view (`Vaqcrow Admin.dc.html`, view
 * `pymes`), React-free. The presentation layer renders it; the adapters supply
 * the data.
 *
 * The template's four display states group the six review states the API
 * exposes: everything not yet decided is `pending`. Copy is verbatim from the
 * template's `ST`/`pymeKpis` maps. The template's numeric KPI values are
 * derived from the loaded page, because the T1 listing exposes neither a state
 * filter nor per-state counts.
 */

export const ADMIN_QUEUE_PAGE_SIZE = 20;

/** The API's declared absence for an application without a business row. */
export const MISSING_BUSINESS_LABEL = "Sin dato";

export const DEFAULT_ADMIN_QUEUE_QUERY: AdminQueueQuery = Object.freeze({
  page: 1,
  pageSize: ADMIN_QUEUE_PAGE_SIZE,
  sort: "updatedAt",
  order: "desc"
});

export type QueueDisplayState = "pending" | "changes" | "approved" | "rejected";

export type QueueIcon = "hourglass" | "create" | "check" | "close";

export type QueueTone = "caution" | "info" | "success" | "critical";

export interface QueueStateCopy {
  readonly label: string;
  readonly tone: QueueTone;
  readonly icon: QueueIcon;
}

/** The template's `ST` map: label, tone and icon per display state. */
export const QUEUE_STATE_COPY: Readonly<Record<QueueDisplayState, QueueStateCopy>> = Object.freeze({
  pending: { label: "Pendiente de revisión", tone: "caution", icon: "hourglass" },
  changes: { label: "Requiere cambios", tone: "info", icon: "create" },
  approved: { label: "Aprobada", tone: "success", icon: "check" },
  rejected: { label: "Rechazada", tone: "critical", icon: "close" }
});

export function queueDisplayState(state: ApplicationReviewState): QueueDisplayState {
  switch (state) {
    case "changes_requested":
      return "changes";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    default:
      return "pending";
  }
}

export type QueueFilterState = "pending" | "changes" | "approved";

export interface QueueKpiFilter {
  readonly state: QueueFilterState;
  readonly label: string;
  readonly icon: QueueIcon;
  readonly tone: QueueTone;
}

/** The template's `pymeKpis` filters, in order. */
export const QUEUE_KPI_FILTERS: readonly QueueKpiFilter[] = Object.freeze([
  { state: "pending", label: "Pendientes de revisión", icon: "hourglass", tone: "caution" },
  { state: "changes", label: "Requieren cambios", icon: "create", tone: "info" },
  { state: "approved", label: "Aprobadas", icon: "check", tone: "success" }
]);

export interface QueueAction {
  readonly label: string;
  readonly primary: boolean;
}

/** Pending rows get the primary review action; every other row a secondary detail. */
export function queueActionFor(state: QueueDisplayState): QueueAction {
  return state === "pending"
    ? { label: "Revisar solicitud", primary: true }
    : { label: "Ver detalle", primary: false };
}

/** Narrows the loaded rows to the active KPI filter; `null` keeps them all. */
export function filterQueueItems(
  items: readonly AdminQueueItem[],
  filter: QueueFilterState | null
): readonly AdminQueueItem[] {
  if (filter === null) return items;
  return items.filter((item) => queueDisplayState(item.state) === filter);
}

/** Counts the loaded rows per KPI filter. */
export function countQueueStates(items: readonly AdminQueueItem[]): Readonly<Record<QueueFilterState, number>> {
  const counts = { pending: 0, changes: 0, approved: 0 };
  for (const item of items) {
    const state = queueDisplayState(item.state);
    if (state !== "rejected") counts[state] += 1;
  }
  return counts;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** `dd/mm/aaaa`, or the honest `Sin dato` when the timestamp cannot be read. */
export function formatQueueUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return MISSING_BUSINESS_LABEL;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Next sort state for a column click: same column flips, a new column starts its natural order. */
export function queueSortToggle(
  current: { readonly sort: AdminQueueSortField; readonly order: AdminQueueSortOrder },
  field: AdminQueueSortField
): { readonly sort: AdminQueueSortField; readonly order: AdminQueueSortOrder } {
  if (current.sort === field) return { sort: field, order: current.order === "asc" ? "desc" : "asc" };
  return { sort: field, order: field === "updatedAt" ? "desc" : "asc" };
}

export function queueTotalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Trims the search box for the `q` parameter; an empty box means no search. */
export function queueSearchOrUndefined(term: string): string | undefined {
  const trimmed = term.trim();
  return trimmed === "" ? undefined : trimmed.slice(0, 100);
}

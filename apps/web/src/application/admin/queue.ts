import type { ApplicationReviewState } from "@vaqcrow/contracts";
import type {
  AdminQueueDisplayState,
  AdminQueueQuery,
  AdminQueueSortField,
  AdminQueueSortOrder
} from "@/application/ports/admin-queue-port";

/**
 * Pure model of the admin PyMEs queue view (`Vaqcrow Admin.dc.html`, view
 * `pymes`), React-free. The presentation layer renders it; the adapters supply
 * the data.
 *
 * The template's four display states group the six review states the API
 * exposes: everything not yet decided is `pending`. Copy is verbatim from the
 * template's `ST`/`pymeKpis` maps. Since T1b the numeric KPI values come from
 * the API's global `counts`, and a KPI selection becomes the server-side
 * `state` filter — neither is derived from the loaded page.
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

export type QueueDisplayState = AdminQueueDisplayState;

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

/**
 * Applies a KPI selection to the query as the server-side `state` filter,
 * always returning to the first page. Selecting the already-active group clears
 * the filter; an active search term is preserved.
 */
export function queueQueryToggleFilter(query: AdminQueueQuery, state: QueueFilterState): AdminQueueQuery {
  const toggled = query.state === state ? null : state;
  return {
    page: 1,
    pageSize: query.pageSize,
    sort: query.sort,
    order: query.order,
    ...(query.search === undefined ? {} : { search: query.search }),
    ...(toggled === null ? {} : { state: toggled })
  };
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

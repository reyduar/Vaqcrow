import { ADMIN_QUEUE_DISPLAY_STATES } from "../ports/sme-request-repository-port.js";
import type {
  AdminQueueCounts,
  AdminQueueDisplayState,
  AdminQueueItem,
  AdminQueueQuery,
  AdminQueueSortField,
  AdminQueueSortOrder,
  SmeRequestRepositoryPort
} from "../ports/sme-request-repository-port.js";

/**
 * The ADMIN PyMEs queue read (#386/T1).
 *
 * Parses and clamps the HTTP query (`page`, `pageSize`, `sort`, `order`, `q`,
 * `state`) into the port's already-resolved `AdminQueueQuery`, then reads one
 * server-side-paginated page. A malformed query — including an unknown display
 * `state` — is a sanitized `invalid_request` and never reaches the repository;
 * a repository failure is `unavailable`, never an empty-but-successful page.
 *
 * The search term is pre-sanitized here because PostgREST has no bound
 * parameters: its filter metacharacters (`,`, `(`, `)`, `*`, `%`, `\`, `"`) are
 * stripped so a caller cannot alter the filter tree or inject a wildcard.
 */

export const DEFAULT_ADMIN_QUEUE_PAGE_SIZE = 20;
export const MAX_ADMIN_QUEUE_PAGE_SIZE = 100;

// A page so far out that the offset would be meaningless is clamped rather than
// submitted to the provider as an enormous offset.
const MAX_ADMIN_QUEUE_PAGE = 100_000;
const MAX_SEARCH_LENGTH = 100;

const SORT_FIELDS: ReadonlySet<AdminQueueSortField> = new Set([
  "applicationId",
  "name",
  "sector",
  "state",
  "updatedAt"
]);
const SORT_ORDERS: ReadonlySet<AdminQueueSortOrder> = new Set(["asc", "desc"]);
const DISPLAY_STATES: ReadonlySet<string> = new Set(ADMIN_QUEUE_DISPLAY_STATES);
const QUERY_KEYS: ReadonlySet<string> = new Set(["page", "pageSize", "sort", "order", "q", "state"]);

const POSITIVE_INTEGER = /^[1-9]\d*$/;
const POSTGREST_METACHARACTERS = /[,()*%\\"]+/g;

export type AdminQueueQueryParse =
  | { readonly ok: true; readonly value: AdminQueueQuery }
  | { readonly ok: false; readonly code: "invalid_request" };

export function parseAdminQueueQuery(raw: unknown): AdminQueueQueryParse {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, code: "invalid_request" };
  }

  const record = raw as Record<string, unknown>;
  if (Object.keys(record).some((key) => !QUERY_KEYS.has(key))) {
    return { ok: false, code: "invalid_request" };
  }

  const page = parsePage(record["page"]);
  if (page === undefined) return { ok: false, code: "invalid_request" };

  const pageSize = parsePageSize(record["pageSize"]);
  if (pageSize === undefined) return { ok: false, code: "invalid_request" };

  const sort = parseSort(record["sort"]);
  if (sort === undefined) return { ok: false, code: "invalid_request" };

  const order = parseOrder(record["order"]);
  if (order === undefined) return { ok: false, code: "invalid_request" };

  const search = parseSearch(record["q"]);
  if (search === "invalid") return { ok: false, code: "invalid_request" };

  const state = parseState(record["state"]);
  if (state === "invalid") return { ok: false, code: "invalid_request" };

  return {
    ok: true,
    value: {
      page,
      pageSize,
      sort,
      order,
      ...(search === undefined ? {} : { search }),
      ...(state === undefined ? {} : { state })
    }
  };
}

export interface ListAdminSmeRequestsValue {
  readonly items: readonly AdminQueueItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly counts: AdminQueueCounts;
}

export type ListAdminSmeRequestsResult =
  | { readonly ok: true; readonly value: ListAdminSmeRequestsValue }
  | { readonly ok: false; readonly error: { readonly code: "invalid_request" | "unavailable" } };

export interface ListAdminSmeRequestsDependencies {
  readonly repository: Pick<SmeRequestRepositoryPort, "listAdminQueue">;
}

export async function listAdminSmeRequests(
  dependencies: ListAdminSmeRequestsDependencies,
  input: { readonly query: unknown }
): Promise<ListAdminSmeRequestsResult> {
  const parsed = parseAdminQueueQuery(input.query);
  if (!parsed.ok) {
    return { ok: false, error: { code: "invalid_request" } };
  }

  const page = await dependencies.repository.listAdminQueue(parsed.value);
  if (!page.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  return {
    ok: true,
    value: {
      items: page.value.items,
      page: parsed.value.page,
      pageSize: parsed.value.pageSize,
      total: page.value.total,
      counts: page.value.counts
    }
  };
}

function parsePage(value: unknown): number | undefined {
  if (value === undefined) return 1;

  const raw = readString(value);
  if (typeof raw !== "string" || !POSITIVE_INTEGER.test(raw)) return undefined;

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) return undefined;
  return Math.min(parsed, MAX_ADMIN_QUEUE_PAGE);
}

function parsePageSize(value: unknown): number | undefined {
  if (value === undefined) return DEFAULT_ADMIN_QUEUE_PAGE_SIZE;

  const raw = readString(value);
  if (typeof raw !== "string" || !POSITIVE_INTEGER.test(raw)) return undefined;

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) return undefined;
  return Math.min(parsed, MAX_ADMIN_QUEUE_PAGE_SIZE);
}

function parseSort(value: unknown): AdminQueueSortField | undefined {
  if (value === undefined) return "updatedAt";

  const raw = readString(value);
  return typeof raw === "string" && SORT_FIELDS.has(raw as AdminQueueSortField)
    ? (raw as AdminQueueSortField)
    : undefined;
}

function parseOrder(value: unknown): AdminQueueSortOrder | undefined {
  if (value === undefined) return "desc";

  const raw = readString(value);
  return typeof raw === "string" && SORT_ORDERS.has(raw as AdminQueueSortOrder)
    ? (raw as AdminQueueSortOrder)
    : undefined;
}

/** A known display group narrows the page; anything else is a sanitized 400. */
function parseState(value: unknown): AdminQueueDisplayState | undefined | "invalid" {
  if (value === undefined) return undefined;

  const raw = readString(value);
  if (typeof raw !== "string") return "invalid";
  return DISPLAY_STATES.has(raw) ? (raw as AdminQueueDisplayState) : "invalid";
}

function parseSearch(value: unknown): string | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return "invalid";

  const normalized = value
    .replace(POSTGREST_METACHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);

  return normalized.length === 0 ? undefined : normalized;
}

/** A repeated (array) or otherwise non-string parameter is malformed. */
function readString(value: unknown): string | undefined | "invalid" {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : "invalid";
}

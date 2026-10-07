import axios, { type AxiosInstance } from "axios";
import { ADMIN_QUEUE_DISPLAY_STATES } from "@/application/ports/admin-queue-port";
import type {
  AdminQueueCounts,
  AdminQueueItem,
  AdminQueuePage,
  AdminQueuePort,
  AdminQueueQuery,
  AdminQueueResult
} from "@/application/ports/admin-queue-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the admin PyMEs queue (Feature #386 / T3), talking to
 * `GET /sme-requests` (T1, ADMIN-only) with the signed-in session's
 * `Authorization: Bearer` token.
 *
 * The route resolves the role from that token, so this adapter sends no role
 * or recipient. A malformed success body collapses to `unavailable` instead of
 * rendering; a transport failure is `network`; every non-200 status is the
 * sanitized `unavailable` (the envelope's `code` never crosses this boundary).
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

const REVIEW_STATES: ReadonlySet<string> = new Set([
  "draft",
  "awaiting_assessment",
  "human_review",
  "approved",
  "changes_requested",
  "rejected"
]);

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseItem(data: unknown): AdminQueueItem | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { applicationId, name, sector, state, updatedAt } = data as Record<string, unknown>;
  if (typeof applicationId !== "string" || applicationId.length === 0) return undefined;
  if (typeof name !== "string") return undefined;
  if (typeof sector !== "string") return undefined;
  if (typeof state !== "string" || !REVIEW_STATES.has(state)) return undefined;
  if (typeof updatedAt !== "string") return undefined;
  return {
    applicationId,
    name,
    sector,
    state: state as AdminQueueItem["state"],
    updatedAt
  };
}

/**
 * The global `counts` object: one non-negative integer per display group. A
 * missing group is `undefined` so the caller never fabricates a KPI number.
 */
function parseCounts(value: unknown): AdminQueueCounts | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const counts = {} as Record<string, number>;
  for (const state of ADMIN_QUEUE_DISPLAY_STATES) {
    const count = record[state];
    if (!isNonNegativeInteger(count)) return undefined;
    counts[state] = count;
  }
  return counts as AdminQueueCounts;
}

/** The `{ items, page, pageSize, total, counts }` envelope; any deviation is `undefined`. */
function parsePage(data: unknown): AdminQueuePage | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { items, page, pageSize, total, counts: rawCounts } = data as Record<string, unknown>;
  if (!Array.isArray(items)) return undefined;
  if (!isPositiveInteger(page) || !isPositiveInteger(pageSize) || !isNonNegativeInteger(total)) return undefined;

  const counts = parseCounts(rawCounts);
  if (counts === undefined) return undefined;

  const parsed: AdminQueueItem[] = [];
  for (const entry of items) {
    const item = parseItem(entry);
    if (!item) return undefined;
    parsed.push(item);
  }
  return { items: parsed, page, pageSize, total, counts };
}

async function headersFor(provider: AccessTokenProvider | undefined): Promise<Record<string, string> | undefined> {
  if (!provider) return undefined;
  let token: string | null;
  try {
    token = await provider();
  } catch {
    return undefined;
  }
  return typeof token === "string" && BEARER_TOKEN_PATTERN.test(token) ? { Authorization: `Bearer ${token}` } : undefined;
}

function queryParams(query: AdminQueueQuery): Record<string, string | number> {
  return {
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    order: query.order,
    ...(query.search === undefined ? {} : { q: query.search }),
    ...(query.state === undefined ? {} : { state: query.state })
  };
}

export class HttpAdminQueueGateway implements AdminQueuePort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpAdminQueueGateway {
    return new HttpAdminQueueGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  async list(query: AdminQueueQuery): Promise<AdminQueueResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/sme-requests", {
        params: queryParams(query),
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      const page = parsePage(response.data);
      return page ? { ok: true, page } : { ok: false, code: "unavailable" };
    } catch {
      return { ok: false, code: "network" };
    }
  }
}

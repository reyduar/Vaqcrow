import { auditLogQuerySchema } from "@vaqcrow/contracts";
import type { AuditLogQuery } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { AuditLogReaderPort } from "../../../application/ports/audit-log-reader-port.js";

/**
 * The ADMIN audit-log read (Feature #390, WU2). Read-only and `ADMIN`-only (see
 * `route-policy.ts`).
 *
 * `GET /admin/audit-log` decodes `search`/`page`/`pageSize` into the shared
 * `AuditLogQuery` with `auditLogQuerySchema`; `page`/`pageSize` default to 1/20
 * when omitted. Unknown query keys, a non-numeric page, or a `pageSize` over 100
 * are a `400 { code: "invalid_request" }` before the reader is touched.
 *
 * Any read failure — a returned `unavailable` or a thrown adapter — is a
 * sanitized `503 { code: "unavailable" }`, never a 200 with an
 * empty-but-misleading page. The 200 body is exactly what the reader returned.
 */

export const DEFAULT_AUDIT_LOG_PAGE = 1;
export const DEFAULT_AUDIT_LOG_PAGE_SIZE = 20;

export interface AuditLogRouteDependencies {
  readonly entries: AuditLogReaderPort;
}

/** Composition-root helper keeps the route's dependency a vendor-free port. */
export function createAdminAuditLogRouteDependencies(
  entries: AuditLogReaderPort
): AuditLogRouteDependencies {
  return { entries };
}

function asRecord(query: unknown): Record<string, unknown> | undefined {
  if (typeof query !== "object" || query === null || Array.isArray(query)) return undefined;
  return query as Record<string, unknown>;
}

/** Fastify hands query values as strings; a non-numeric one stays `"invalid"`. */
function integerParam(value: unknown): number | "invalid" | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : "invalid";
  }
  return "invalid";
}

/**
 * Normalizes the raw query into the schema's shape: numbers for `page`/
 * `pageSize` (defaulted when absent) and the raw object spread in so
 * `strictObject` still rejects an unknown key.
 */
export function parseAuditLogQueryParams(query: unknown): AuditLogQuery | undefined {
  const record = asRecord(query);
  if (record === undefined) return undefined;

  const page = integerParam(record["page"]);
  const pageSize = integerParam(record["pageSize"]);
  if (page === "invalid" || pageSize === "invalid") return undefined;

  const parsed = auditLogQuerySchema.safeParse({
    ...record,
    page: page ?? DEFAULT_AUDIT_LOG_PAGE,
    pageSize: pageSize ?? DEFAULT_AUDIT_LOG_PAGE_SIZE
  });
  return parsed.success ? parsed.data : undefined;
}

export function registerAdminAuditLogRoute(
  app: FastifyInstance,
  dependencies: AuditLogRouteDependencies
): void {
  app.get("/admin/audit-log", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const query = parseAuditLogQueryParams(request.query);
    if (query === undefined) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    try {
      const result = await dependencies.entries.list(query);
      if (!result.ok) {
        return reply.code(503).send({ code: "unavailable" });
      }

      return reply.code(200).send(result.value);
    } catch {
      // The port contract is to return `unavailable`, never throw; if an adapter
      // breaks it, the failure is still a sanitized 503, never a 500 that could
      // echo the thrown message.
      return reply.code(503).send({ code: "unavailable" });
    }
  });
}

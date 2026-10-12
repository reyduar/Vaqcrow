import { adminUsersQuerySchema } from "@vaqcrow/contracts";
import type { AdminUsersQuery } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { AdminUsersReaderPort } from "../../../application/ports/admin-users-reader-port.js";

/**
 * The ADMIN users list (Feature #390, WU2). Read-only and `ADMIN`-only (see
 * `route-policy.ts`).
 *
 * `GET /admin/users` decodes `search`/`role`/`status`/`page`/`pageSize` into the
 * shared `AdminUsersQuery` with `adminUsersQuerySchema`; `page`/`pageSize`
 * default to 1/20 when omitted. Unknown query keys, a non-numeric page, or a
 * `pageSize` over 100 are a `400 { code: "invalid_request" }` before the reader
 * is touched. The caller is always `request.principal` — a query- or
 * body-supplied identity is ignored, and `principal.userId` only feeds `isSelf`;
 * it never narrows the listing, because an admin reads every account.
 *
 * Any read failure — a returned `unavailable` or a thrown adapter — is a
 * sanitized `503 { code: "unavailable" }`, never a 200 with an
 * empty-but-misleading page. The 200 body is exactly what the reader returned.
 */

export const DEFAULT_ADMIN_USERS_PAGE = 1;
export const DEFAULT_ADMIN_USERS_PAGE_SIZE = 20;

export interface AdminUsersRouteDependencies {
  readonly users: AdminUsersReaderPort;
}

/** Composition-root helper keeps the route's dependency a vendor-free port. */
export function createAdminUsersRouteDependencies(
  users: AdminUsersReaderPort
): AdminUsersRouteDependencies {
  return { users };
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
export function parseAdminUsersQueryParams(query: unknown): AdminUsersQuery | undefined {
  const record = asRecord(query);
  if (record === undefined) return undefined;

  const page = integerParam(record["page"]);
  const pageSize = integerParam(record["pageSize"]);
  if (page === "invalid" || pageSize === "invalid") return undefined;

  const parsed = adminUsersQuerySchema.safeParse({
    ...record,
    page: page ?? DEFAULT_ADMIN_USERS_PAGE,
    pageSize: pageSize ?? DEFAULT_ADMIN_USERS_PAGE_SIZE
  });
  return parsed.success ? parsed.data : undefined;
}

export function registerAdminUsersRoute(
  app: FastifyInstance,
  dependencies: AdminUsersRouteDependencies
): void {
  app.get("/admin/users", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const query = parseAdminUsersQueryParams(request.query);
    if (query === undefined) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    try {
      const result = await dependencies.users.list(query, principal.userId);
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

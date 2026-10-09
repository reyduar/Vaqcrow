import type { FastifyInstance } from "fastify";
import {
  getInvestorReport,
  getInvestorReportSalesByPyme,
  type GetInvestorReportDependencies
} from "../../../application/use-cases/get-investor-report.js";

/**
 * The investor report surface (#430, WU1).
 *
 * `GET /reports` returns the signed-in caller's report for a `YYYY-MM` range
 * (KPIs, monthly series, latest distributions) and `GET /reports/sales-by-pyme`
 * returns the declared-sales block on its own, so the web can render its own
 * partial-error state for that section. Both are available to **every
 * authenticated role** (owner decision D1) and always scope to
 * `request.principal.userId`: any `investor`/account query parameter (or body)
 * is ignored, and the use case resolves the Stellar account server-side from the
 * principal's stored profile key.
 *
 * A malformed or one-sided `from`/`to` is a `400 { code: "invalid_request" }`.
 * Every other failure is a sanitized `503 { code: "unavailable" }`, never a 200
 * with an empty but misleading report.
 */
export type ReportsRouteDependencies = GetInvestorReportDependencies;

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

type RangeQuery = { readonly ok: true; readonly from?: string; readonly to?: string } | { readonly ok: false };

/**
 * Reads and validates the `from`/`to` query pair. Both omitted is legal (the
 * use case defaults to the investor's data range); one alone, a bad format or an
 * inverted pair is `{ ok: false }`.
 */
function parseRangeQuery(query: unknown): RangeQuery {
  if (typeof query !== "object" || query === null || Array.isArray(query)) return { ok: true };
  const record = query as Record<string, unknown>;
  const from = record["from"];
  const to = record["to"];
  if (from === undefined && to === undefined) return { ok: true };
  if (typeof from !== "string" || typeof to !== "string") return { ok: false };
  if (!PERIOD_PATTERN.test(from) || !PERIOD_PATTERN.test(to)) return { ok: false };
  if (from > to) return { ok: false };
  return { ok: true, from, to };
}

function requirePrincipal(principal: { readonly userId: string } | undefined): string | undefined {
  return principal?.userId;
}

export function registerReportsRoute(app: FastifyInstance, dependencies: ReportsRouteDependencies): void {
  app.get("/reports", async (request, reply) => {
    const userId = requirePrincipal(request.principal);
    if (userId === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const range = parseRangeQuery(request.query);
    if (!range.ok) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    const result = await getInvestorReport(dependencies, {
      userId,
      ...(range.from === undefined ? {} : { from: range.from }),
      ...(range.to === undefined ? {} : { to: range.to })
    });
    if (!result.ok) {
      return result.error.code === "invalid_request"
        ? reply.code(400).send({ code: "invalid_request" })
        : reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send(result.value);
  });

  app.get("/reports/sales-by-pyme", async (request, reply) => {
    const userId = requirePrincipal(request.principal);
    if (userId === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const range = parseRangeQuery(request.query);
    if (!range.ok) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    const result = await getInvestorReportSalesByPyme(dependencies, {
      userId,
      ...(range.from === undefined ? {} : { from: range.from }),
      ...(range.to === undefined ? {} : { to: range.to })
    });
    if (!result.ok) {
      return result.error.code === "invalid_request"
        ? reply.code(400).send({ code: "invalid_request" })
        : reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send(result.value);
  });
}

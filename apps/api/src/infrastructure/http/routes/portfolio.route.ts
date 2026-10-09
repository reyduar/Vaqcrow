import type { FastifyInstance } from "fastify";
import {
  getInvestorPortfolio,
  type GetInvestorPortfolioDependencies
} from "../../../application/use-cases/get-investor-portfolio.js";

/**
 * The investor's portfolio surface (#426, WU1).
 *
 * `GET /portfolio` is `INVERSOR`-only (see `route-policy.ts`) and returns the
 * signed-in investor's own contributions, received distributions and totals.
 * The identity is always `request.principal.userId`: any `investor` query
 * parameter (or body) is ignored, so a caller can only ever read its own
 * portfolio. The use case resolves the Stellar account server-side from the
 * principal's stored profile key.
 *
 * Every failure is a sanitized `{ code }`: a repository or key failure is a
 * `503 { code: "unavailable" }`, never a 200 with an empty but misleading
 * portfolio.
 */
export type PortfolioRouteDependencies = GetInvestorPortfolioDependencies;

export function registerPortfolioRoute(app: FastifyInstance, dependencies: PortfolioRouteDependencies): void {
  app.get("/portfolio", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await getInvestorPortfolio(dependencies, { userId: principal.userId });
    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send(result.value);
  });
}

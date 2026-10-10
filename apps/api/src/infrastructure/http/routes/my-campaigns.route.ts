import type { FastifyInstance } from "fastify";
import {
  getMyCampaigns,
  type GetMyCampaignsDependencies
} from "../../../application/use-cases/get-my-campaigns.js";

/**
 * The PyME dashboard surface (#434, WU1).
 *
 * `GET /my-campaigns` is `PYME`-only (see `route-policy.ts`) and returns **all**
 * of the signed-in PyME's campaigns — current and historic — each with the
 * dashboard fields. The identity is always `request.principal.userId`: any
 * `owner` query parameter (or body) is ignored, so a caller can only ever read
 * its own campaigns.
 *
 * Every failure is a sanitized `{ code }`: a repository failure is a
 * `503 { code: "unavailable" }`, never a 200 with an empty but misleading
 * dashboard.
 */
export type MyCampaignsRouteDependencies = GetMyCampaignsDependencies;

export function registerMyCampaignsRoute(app: FastifyInstance, dependencies: MyCampaignsRouteDependencies): void {
  app.get("/my-campaigns", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await getMyCampaigns(dependencies, { userId: principal.userId });
    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send(result.value);
  });
}

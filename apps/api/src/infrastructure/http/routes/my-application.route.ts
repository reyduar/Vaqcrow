import type { FastifyInstance } from "fastify";
import {
  getMyApplication,
  type GetMyApplicationDependencies
} from "../../../application/use-cases/get-my-application.js";

/**
 * The PyME company post-submission surface (#530, T1).
 *
 * `GET /sme-requests/mine` is `PYME`-only (see `route-policy.ts`) and returns
 * the caller's own latest application and its real review state, or
 * `{ application: null }` when the caller owns none. The identity is always
 * `request.principal.userId`: any `owner` query parameter (or body) is ignored,
 * so a caller can only ever read its own application.
 *
 * It is a **static** route registered beside `/sme-requests/:applicationId`, and
 * Fastify resolves the static one first, so the existing per-id read is
 * untouched.
 *
 * A repository failure is a sanitized `503 { code: "unavailable" }`, never a 200
 * with a misleading state.
 */
export type MyApplicationRouteDependencies = GetMyApplicationDependencies;

export function registerMyApplicationRoute(
  app: FastifyInstance,
  dependencies: MyApplicationRouteDependencies
): void {
  app.get("/sme-requests/mine", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await getMyApplication(dependencies, { ownerUserId: principal.userId });
    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send({ application: result.value });
  });
}

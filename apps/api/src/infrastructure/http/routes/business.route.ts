import type { FastifyInstance } from "fastify";
import type { BusinessRepositoryPort } from "../../../application/ports/business-repository-port.js";
import { createBusiness, getMyBusiness } from "../../../application/use-cases/business.js";

/**
 * The HTTP surface of the PyME company (Feature #398, Task #399 / T3b).
 *
 * `POST /businesses` creates the caller's company and `GET /businesses/mine`
 * reads it back. Both require `PYME` (see `route-policy.ts`) and both take the
 * owner from `request.principal.userId` — never from the body or the path.
 *
 * The status mapping follows the established conventions: `201` on create,
 * `200` on read, `400 { errors: [{ field, code }] }` for a body that fails
 * validation, `404` when the caller has no company, and a sanitized `503` for
 * every provider failure.
 */

export interface BusinessRouteDependencies {
  readonly repository: BusinessRepositoryPort;
}

export function registerBusinessRoute(
  app: FastifyInstance,
  dependencies: BusinessRouteDependencies
): void {
  app.post<{ Body: unknown }>("/businesses", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await createBusiness(
      { repository: dependencies.repository },
      { ownerUserId: principal.userId, body: request.body }
    );

    if (result.ok) {
      return reply.code(201).send({ business: result.value });
    }

    return result.error.code === "invalid_request"
      ? reply.code(400).send({ errors: result.error.fieldErrors })
      : reply.code(503).send({ code: "unavailable" });
  });

  app.get("/businesses/mine", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await getMyBusiness(
      { repository: dependencies.repository },
      { ownerUserId: principal.userId }
    );

    if (result.ok) {
      return reply.code(200).send({ business: result.value });
    }

    return result.error.code === "not_found"
      ? reply.code(404).send({ code: "not_found" })
      : reply.code(503).send({ code: "unavailable" });
  });
}

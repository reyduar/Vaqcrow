import type { ApplicationId } from "@vaqcrow/contracts";
import { parseApplicationId } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { AdminReviewContextPort } from "../../../application/ports/admin-review-context-port.js";
import { getAdminReviewContext } from "../../../application/use-cases/get-admin-review-context.js";
import type { GetAdminReviewContextDependencies } from "../../../application/use-cases/get-admin-review-context.js";

export interface AdminReviewContextRouteDependencies {
  readonly context: Pick<AdminReviewContextPort, "get">;
}

export function registerAdminReviewContextRoute(
  app: FastifyInstance,
  dependencies: AdminReviewContextRouteDependencies
): void {
  app.get<{ Params: { applicationId: string } }>(
    "/application-reviews/:applicationId/context",
    async (request, reply) => {
      let applicationId: ApplicationId;
      try {
        applicationId = parseApplicationId(request.params.applicationId);
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      try {
        const result = await dependencies.context.get(applicationId);
        if (result.ok) {
          return reply.code(200).send(result.value);
        }

        return result.error.code === "not_found"
          ? reply.code(404).send({ code: "not_found" })
          : reply.code(503).send({ code: "unavailable" });
      } catch {
        return reply.code(503).send({ code: "unavailable" });
      }
    }
  );
}

/** Composition-root helper keeps the route's dependency a vendor-free port. */
export function createAdminReviewContextRouteDependencies(
  dependencies: GetAdminReviewContextDependencies
): AdminReviewContextRouteDependencies {
  return { context: { get: (applicationId) => getAdminReviewContext(dependencies, { applicationId }) } };
}

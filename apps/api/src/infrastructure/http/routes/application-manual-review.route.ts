import { parseApplicationId } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { ApplicationReviewRepositoryPort } from "../../../application/ports/application-review-repository-port.js";

/**
 * The read surface of the manual-review context (Feature #22, Task #71).
 *
 * The endpoint is application-scoped and read-only: it returns exactly the
 * persisted manual-review context for an application whose failed assessment
 * was routed to human review, or a truthful `not_found` when no handoff exists.
 * It never fabricates empty-but-successful content, and it never adds provider
 * diagnostics — the durable record has none.
 *
 * Status mapping follows the established conventions (`human-decision.route.ts`,
 * `application-assessment.route.ts`): `400` for a malformed path before any
 * repository call, `404` unknown application/no handoff, `503` a sanitized
 * `unavailable` for every other repository failure.
 */

export interface ApplicationManualReviewRouteDependencies {
  readonly repository: Pick<ApplicationReviewRepositoryPort, "readManualReviewContext">;
}

export function registerApplicationManualReviewRoute(
  app: FastifyInstance,
  dependencies: ApplicationManualReviewRouteDependencies
): void {
  app.get<{ Params: { applicationId: string } }>(
    "/application-reviews/:applicationId/manual-review",
    async (request, reply) => {
      let applicationId;
      try {
        applicationId = parseApplicationId(request.params.applicationId);
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await dependencies.repository.readManualReviewContext(applicationId);

      if (result.ok) {
        return reply.code(200).send(result.value);
      }

      switch (result.error.code) {
        case "not_found":
          return reply.code(404).send({ code: "not_found" });
        // A read only emits `not_found` or `unavailable`; anything else would be
        // an unexpected repository outcome and is reported as unavailable.
        default:
          return reply.code(503).send({ code: "unavailable" });
      }
    }
  );
}

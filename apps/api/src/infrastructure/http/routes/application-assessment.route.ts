import { parseAssessmentEvidenceBundle } from "@vaqcrow/ai";
import type { AssessmentProviderPort } from "@vaqcrow/ai";
import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { ApplicationReviewRepositoryPort } from "../../../application/ports/application-review-repository-port.js";
import { routeAssessmentFailureToManualReview } from "../../../application/use-cases/route-assessment-failure-to-manual-review.js";

/**
 * The application-scoped assessment surface (Feature #22, Task #71).
 *
 * It runs the same provider-independent assessment the standalone `POST
 * /assessments` runs, but bound to an application: a closed-set failure is
 * persisted as a sanitized handoff and routed to truthful manual review, while a
 * valid assessment is returned advisory and leaves the application untouched.
 * The route owns exactly what the other routes own — the exact body key set,
 * the status mapping and the correlation identity — plus the application id.
 *
 * The provider and the timeout arrive from the dependencies; a request can never
 * choose them. The standalone `POST /assessments` contract is not changed.
 */

const BODY_KEYS = new Set(["evidence"]);

export interface ApplicationAssessmentRouteDependencies {
  readonly repository: Pick<
    ApplicationReviewRepositoryPort,
    "findById" | "recordAssessmentFailureHandoff" | "transition"
  >;
  readonly provider: AssessmentProviderPort;
  readonly timeoutMs: number;
}

function hasExactBodyKeys(input: unknown): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }

  const keys = Object.keys(input);
  return keys.length === BODY_KEYS.size && keys.every((key) => BODY_KEYS.has(key));
}

export function registerApplicationAssessmentRoute(
  app: FastifyInstance,
  dependencies: ApplicationAssessmentRouteDependencies
): void {
  app.post<{ Params: { applicationId: string }; Body: unknown }>(
    "/application-reviews/:applicationId/assessments",
    async (request, reply) => {
      if (!hasExactBodyKeys(request.body)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      let applicationId;
      let evidence;
      try {
        applicationId = parseApplicationId(request.params.applicationId);
        evidence = parseAssessmentEvidenceBundle(request.body["evidence"]);
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await routeAssessmentFailureToManualReview(dependencies, {
        applicationId,
        evidence,
        correlationId: parseCorrelationId(request.id)
      });

      if (result.ok) {
        // 201 when this call performed the routing, 200 when it was already
        // applied (same-correlation replay, or already in human_review).
        return reply
          .code(result.value.outcome === "manual_review" && result.value.applied ? 201 : 200)
          .send(result.value);
      }

      switch (result.error.code) {
        case "not_found":
          return reply.code(404).send({ code: "not_found" });
        case "state_conflict":
          return reply
            .code(409)
            .send({ code: "state_conflict", actualState: result.error.actualState });
        case "correlation_conflict":
          return reply.code(409).send({ code: "correlation_conflict" });
        case "unavailable":
          return reply.code(503).send({ code: "unavailable" });
      }
    }
  );
}

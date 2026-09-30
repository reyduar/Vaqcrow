import type { AssessmentProviderPort } from "@vaqcrow/ai";
import {
  parseApplicationId,
  parseAssessmentHandoffId,
  parseCorrelationId
} from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { ApplicationAssessmentRepositoryPort } from "../../../application/ports/application-assessment-repository-port.js";
import type { ApplicationReviewRepositoryPort } from "../../../application/ports/application-review-repository-port.js";
import type { SalesDataProviderPort } from "../../../application/ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../../../application/ports/sme-request-repository-port.js";
import { routeApplicationAssessment } from "../../../application/use-cases/route-application-assessment.js";

/**
 * The application-scoped assessment surface (Feature #22 Task #71, Feature #30
 * Task #95 / T3a).
 *
 * `POST` runs the same provider-independent assessment the standalone `POST
 * /assessments` runs, bound to an application and fed by evidence the server
 * derives from the persisted SME request and its sales periods — the body is
 * only `{ handoffId }`, a client can no longer supply evidence. A valid
 * assessment is persisted and the application moves to `human_review` in one
 * atomic command (201 recorded, 200 same-attempt replay); a closed-set failure is
 * persisted as a sanitized handoff and routed to truthful manual review; a
 * request with no sales periods is `409 sales_evidence_missing` and changes
 * nothing. `GET` reads the persisted assessment (404 until one is recorded).
 *
 * `handoffId` is the caller's per-attempt idempotency key for both outcomes: it
 * is the recorded assessment's attempt id and the failure handoff's durable
 * correlation, so retrying the same attempt replays and a different key against
 * a durable record is an explicit `correlation_conflict`. `request.id` stays the
 * transport correlation (the `x-correlation-id` header) and never decides replay.
 *
 * The provider and the timeout arrive from the dependencies; a request can never
 * choose them. The standalone `POST /assessments` contract is not changed.
 */

const BODY_KEYS = new Set(["handoffId"]);

export interface ApplicationAssessmentRouteDependencies {
  readonly repository: Pick<
    ApplicationReviewRepositoryPort,
    "findById" | "recordAssessmentFailureHandoff" | "transition"
  >;
  readonly assessments: Pick<
    ApplicationAssessmentRepositoryPort,
    "record" | "findByApplicationId" | "findStoredByApplicationId"
  >;
  readonly smeRequests: Pick<SmeRequestRepositoryPort, "findByApplicationId">;
  readonly salesData: Pick<SalesDataProviderPort, "getPeriods">;
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
      let handoffId;
      try {
        applicationId = parseApplicationId(request.params.applicationId);
        handoffId = parseAssessmentHandoffId(request.body["handoffId"]);
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await routeApplicationAssessment(dependencies, {
        applicationId,
        handoffId,
        // Transport trace only: request.id never decides replay.
        correlationId: parseCorrelationId(request.id)
      });

      if (result.ok) {
        // 201 when this call performed the recording/routing, 200 when it was
        // already applied (same-key replay or crash recovery, or already in
        // human_review).
        return reply.code(result.value.applied ? 201 : 200).send(result.value);
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
        case "sales_evidence_missing":
          return reply.code(409).send({ code: "sales_evidence_missing" });
        case "unavailable":
          return reply.code(503).send({ code: "unavailable" });
      }
    }
  );

  app.get<{ Params: { applicationId: string } }>(
    "/application-reviews/:applicationId/assessment",
    async (request, reply) => {
      let applicationId;
      try {
        applicationId = parseApplicationId(request.params.applicationId);
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await dependencies.assessments.findByApplicationId(applicationId);

      if (result.ok) {
        return reply.code(200).send(result.value);
      }

      return result.error.code === "not_found"
        ? reply.code(404).send({ code: "not_found" })
        : reply.code(503).send({ code: "unavailable" });
    }
  );
}

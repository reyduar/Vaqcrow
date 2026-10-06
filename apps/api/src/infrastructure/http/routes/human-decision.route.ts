import { parseApplicationId, parseCorrelationId, parseHumanDecisionCommand } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { recordHumanDecision } from "../../../application/use-cases/record-human-decision.js";
import type { DecisionNotificationDependencies } from "../../../application/use-cases/record-human-decision.js";
import type { ApplicationReviewRepositoryPort } from "../../../application/ports/application-review-repository-port.js";

const BODY_KEYS = new Set(["decisionId", "outcome", "reason", "approvedLimitArs"]);

function hasExactBodyKeys(input: unknown): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }

  const keys = Object.keys(input);
  return keys.length === BODY_KEYS.size && keys.every((key) => BODY_KEYS.has(key));
}

export function registerHumanDecisionRoute(
  app: FastifyInstance,
  repository: ApplicationReviewRepositoryPort,
  decisionNotifications?: DecisionNotificationDependencies
): void {
  app.post<{ Params: { applicationId: string }; Body: unknown }>(
    "/application-reviews/:applicationId/decisions",
    async (request, reply) => {
      // The actor is the authenticated admin, never a body field (D5).
      const principal = request.principal;
      if (principal === undefined) {
        return reply.code(401).send({ code: "unauthenticated" });
      }

      if (!hasExactBodyKeys(request.body)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      let command;
      try {
        command = parseHumanDecisionCommand({
          applicationId: request.params.applicationId,
          decisionId: request.body["decisionId"],
          outcome: request.body["outcome"],
          actor: principal.displayName,
          reason: request.body["reason"],
          approvedLimitArs: request.body["approvedLimitArs"]
        });
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await recordHumanDecision(
        repository,
        {
          command,
          correlationId: parseCorrelationId(request.id)
        },
        decisionNotifications
      );

      if (result.ok) {
        return reply.code(result.value.applied ? 201 : 200).send({
          applied: result.value.applied,
          decision: result.value.decision
        });
      }

      switch (result.error.code) {
        case "not_found":
          return reply.code(404).send({ code: "not_found" });
        case "state_conflict":
          return reply.code(409).send({
            code: "state_conflict",
            actualState: result.error.actualState
          });
        case "idempotency_conflict":
          return reply.code(409).send({ code: "idempotency_conflict" });
        case "unavailable":
          return reply.code(503).send({ code: "unavailable" });
      }
    }
  );

  /**
   * The read surface of the latest recorded decision (Feature #29, Task #92).
   *
   * The endpoint is application-scoped and read-only: it returns exactly the most
   * recently recorded human decision for an application, or a truthful `not_found`
   * when none has been recorded yet — a declared absence, never an empty success.
   */
  app.get<{ Params: { applicationId: string } }>(
    "/application-reviews/:applicationId/decisions",
    async (request, reply) => {
      let applicationId;
      try {
        applicationId = parseApplicationId(request.params.applicationId);
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await repository.readLatestHumanDecision(applicationId);

      if (result.ok) {
        return reply.code(200).send({ decision: result.value });
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

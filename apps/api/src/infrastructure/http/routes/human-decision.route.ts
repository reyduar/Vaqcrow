import { parseCorrelationId, parseHumanDecisionCommand } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { recordHumanDecision } from "../../../application/use-cases/record-human-decision.js";
import type { ApplicationReviewRepositoryPort } from "../../../application/ports/application-review-repository-port.js";

const BODY_KEYS = new Set(["decisionId", "outcome", "actor", "reason", "approvedLimitArs"]);

function hasExactBodyKeys(input: unknown): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }

  const keys = Object.keys(input);
  return keys.length === BODY_KEYS.size && keys.every((key) => BODY_KEYS.has(key));
}

export function registerHumanDecisionRoute(
  app: FastifyInstance,
  repository: ApplicationReviewRepositoryPort
): void {
  app.post<{ Params: { applicationId: string }; Body: unknown }>(
    "/application-reviews/:applicationId/decisions",
    async (request, reply) => {
      if (!hasExactBodyKeys(request.body)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      let command;
      try {
        command = parseHumanDecisionCommand({
          applicationId: request.params.applicationId,
          decisionId: request.body["decisionId"],
          outcome: request.body["outcome"],
          actor: request.body["actor"],
          reason: request.body["reason"],
          approvedLimitArs: request.body["approvedLimitArs"]
        });
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await recordHumanDecision(repository, {
        command,
        correlationId: parseCorrelationId(request.id)
      });

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
}

import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import type { ApplicationId, CorrelationId } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type {
  CampaignDeploymentRecord,
  CampaignDeploymentRepositoryPort
} from "../../../application/ports/campaign-deployment-repository-port.js";
import type { DeployApprovedCampaignResult } from "../../../application/use-cases/deploy-approved-campaign.js";
import { isDeploymentRetryable } from "../../../application/use-cases/deployment-staleness.js";

/**
 * The HTTP surface of the vault-deployment lifecycle (Feature #410, Task #410 /
 * T5b): the admin deploys or retries an approved application and reads the
 * read-only detail that the review console shows. Both are ADMIN-only.
 *
 * `deploy` is the use case, injected rather than imported, so the route owns
 * only the wire contract (path parsing, status mapping, the sanitized body).
 */

export type DeployApprovedCampaign = (input: {
  readonly applicationId: ApplicationId;
  readonly correlationId: CorrelationId;
}) => Promise<DeployApprovedCampaignResult>;

export interface CampaignDeploymentRouteDependencies {
  readonly deployments: CampaignDeploymentRepositoryPort;
  readonly deploy: DeployApprovedCampaign;
  /** The clock `retryable` is computed with; defaults to the real one. */
  readonly now?: () => Date;
}

/**
 * The read-only projection of one deployment. `lastCorrelationId` is internal
 * provenance and never crosses the wire; `lastError` is already a sanitized code.
 * `retryable` (U8) is decided here, server-side: the last attempt failed, or a
 * `deploying` attempt was abandoned past the stale threshold.
 */
function toDeploymentWire(record: CampaignDeploymentRecord, now: Date): Record<string, unknown> {
  return {
    applicationId: record.applicationId,
    state: record.state,
    attempts: record.attempts,
    ...(record.campaignId === undefined ? {} : { campaignId: record.campaignId }),
    ...(record.lastError === undefined ? {} : { lastError: record.lastError }),
    retryable: isDeploymentRetryable(record, now),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function registerCampaignDeploymentRoute(
  app: FastifyInstance,
  dependencies: CampaignDeploymentRouteDependencies
): void {
  const now = dependencies.now ?? (() => new Date());

  app.post<{ Params: { applicationId: string } }>(
    "/application-reviews/:applicationId/deployment",
    async (request, reply) => {
      let applicationId;
      try {
        applicationId = parseApplicationId(request.params.applicationId);
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await dependencies.deploy({
        applicationId,
        correlationId: parseCorrelationId(request.id)
      });

      if (result.ok) {
        return reply.code(200).send({ deployment: toDeploymentWire(result.value.deployment, now()) });
      }

      switch (result.error.code) {
        case "application_not_found":
          return reply.code(404).send({ code: "application_not_found" });
        case "application_not_approved":
          return reply.code(409).send({ code: "application_not_approved" });
        case "deployment_in_progress":
          // A recent attempt still owns the row; the console re-reads it.
          return reply.code(409).send({ code: "deployment_in_progress" });
        case "owner_unresolved":
        case "terms_unavailable":
        case "wallet_required":
        case "goal_limit_exceeded":
          // A precondition the PyME has not satisfied yet, or a policy refusal.
          return reply.code(422).send({ code: result.error.code });
        case "rate_unavailable":
        case "unavailable":
          // A dependency (rate table, Testnet, database) failed; no provider
          // text crosses this boundary.
          return reply.code(503).send({ code: result.error.code });
      }
    }
  );

  app.get<{ Params: { applicationId: string } }>(
    "/application-reviews/:applicationId/deployment",
    async (request, reply) => {
      let applicationId;
      try {
        applicationId = parseApplicationId(request.params.applicationId);
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await dependencies.deployments.findByApplicationId(applicationId);

      if (result.ok) {
        return reply.code(200).send({ deployment: toDeploymentWire(result.value, now()) });
      }

      return result.error.code === "not_found"
        ? reply.code(404).send({ code: "not_found" })
        : reply.code(503).send({ code: "unavailable" });
    }
  );
}

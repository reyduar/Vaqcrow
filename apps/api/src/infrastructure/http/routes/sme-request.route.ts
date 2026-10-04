import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import type { ApplicationId } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { SalesDataProviderPort } from "../../../application/ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../../../application/ports/sme-request-repository-port.js";
import { getSmeRequest } from "../../../application/use-cases/get-sme-request.js";
import { submitSmeRequest } from "../../../application/use-cases/submit-sme-request.js";

/**
 * The HTTP surface of the SME request (Feature #30, Task #95 / T2a).
 *
 * `POST /sme-requests` creates the application (the root id of the demo
 * journey, generated server-side) together with its request: `201` the first
 * time, `200` on an idempotent replay. A body that fails the shared contract is
 * refused with `400 { errors: [{ field, code }] }`, the envelope `apps/web`
 * already understands; persistence failures are a sanitized `503`.
 *
 * `GET /sme-requests/:applicationId` returns the persisted request with its
 * monthly sales series; a malformed id is `400`, an unknown application `404`.
 * A request that belongs to another owner is reported as `404` too (R1-002):
 * the caller's principal scopes every read.
 */

export interface SmeRequestRouteDependencies {
  readonly repository: SmeRequestRepositoryPort;
  readonly salesData: Pick<SalesDataProviderPort, "getPeriods">;
  readonly generateApplicationId: () => ApplicationId;
}

export function registerSmeRequestRoute(app: FastifyInstance, dependencies: SmeRequestRouteDependencies): void {
  app.post<{ Body: unknown }>("/sme-requests", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await submitSmeRequest(
      { repository: dependencies.repository, generateApplicationId: dependencies.generateApplicationId },
      { body: request.body, correlationId: parseCorrelationId(request.id), ownerUserId: principal.userId }
    );

    if (result.ok) {
      return reply
        .code(result.value.applied ? 201 : 200)
        .send({ applicationId: result.value.applicationId, request: result.value.request });
    }

    if (result.error.code === "invalid_request") {
      return reply.code(400).send({ errors: result.error.fieldErrors });
    }

    return reply.code(503).send({ code: "unavailable" });
  });

  app.get<{ Params: { applicationId: string } }>("/sme-requests/:applicationId", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    let applicationId;
    try {
      applicationId = parseApplicationId(request.params.applicationId);
    } catch {
      return reply.code(400).send({ code: "invalid_request" });
    }

    const result = await getSmeRequest(
      { repository: dependencies.repository, salesData: dependencies.salesData },
      { applicationId, ownerUserId: principal.userId }
    );

    if (result.ok) {
      return reply.code(200).send(result.value);
    }

    return result.error.code === "not_found"
      ? reply.code(404).send({ code: "not_found" })
      : reply.code(503).send({ code: "unavailable" });
  });
}

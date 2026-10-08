import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import type { ApplicationId } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { BusinessRepositoryPort } from "../../../application/ports/business-repository-port.js";
import type { NotificationPublisherPort } from "../../../application/ports/notification-publisher-port.js";
import type { SalesDataProviderPort } from "../../../application/ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../../../application/ports/sme-request-repository-port.js";
import type { WalletRepositoryPort } from "../../../application/ports/wallet-repository-port.js";
import { getSmeRequest } from "../../../application/use-cases/get-sme-request.js";
import { listAdminSmeRequests } from "../../../application/use-cases/list-admin-sme-requests.js";
import { submitSmeRequest } from "../../../application/use-cases/submit-sme-request.js";
import type { SubmissionAssessmentDependencies } from "../../../application/use-cases/submit-sme-request.js";

/**
 * The HTTP surface of the SME request (Feature #30, Task #95 / T2a).
 *
 * `POST /sme-requests` creates the application (the root id of the demo
 * journey, generated server-side) together with its request: `201` the first
 * time, `200` on an idempotent replay. A submission without a stored wallet key
 * is refused `409 { code: "wallet_required" }`; a body that fails the shared
 * contract is refused with `400 { errors: [{ field, code }] }`, the envelope
 * `apps/web` already understands; persistence failures are a sanitized `503`.
 * On a real apply only, the admin `new_application` event is published
 * best-effort and the advisory assessment is started in the background (U12),
 * never awaited: neither can change the response.
 *
 * `GET /sme-requests/:applicationId` returns the persisted request with its
 * monthly sales series; a malformed id is `400`, an unknown application `404`.
 * A request that belongs to another owner is reported as `404` too (R1-002):
 * the caller's principal scopes every read.
 *
 * `GET /sme-requests` is the ADMIN-only PyMEs queue (#386/T1): a
 * server-side-paginated, sorted and searched page of every application with its
 * company name, sector, review state and last change (the queue's own
 * `items`/`page`/`pageSize`/`total` envelope). T1b adds an optional `state`
 * display-group filter and the global `counts` object (one number per display
 * group, never page-scoped). A malformed query, including an unknown `state`,
 * is a sanitized `400`; a provider failure a sanitized `503`.
 */

export interface SmeRequestRouteDependencies {
  readonly repository: SmeRequestRepositoryPort;
  readonly salesData: Pick<SalesDataProviderPort, "getPeriods">;
  readonly wallet: Pick<WalletRepositoryPort, "readPublicKey">;
  readonly businesses: Pick<BusinessRepositoryPort, "findByOwner">;
  readonly notifications: Pick<NotificationPublisherPort, "publish">;
  readonly generateApplicationId: () => ApplicationId;
  /** Optional background assessment of an applied submission (U12). */
  readonly assessment?: SubmissionAssessmentDependencies | undefined;
}

export function registerSmeRequestRoute(app: FastifyInstance, dependencies: SmeRequestRouteDependencies): void {
  app.post<{ Body: unknown }>("/sme-requests", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await submitSmeRequest(
      {
        repository: dependencies.repository,
        wallet: dependencies.wallet,
        businesses: dependencies.businesses,
        notifications: dependencies.notifications,
        generateApplicationId: dependencies.generateApplicationId,
        assessment: dependencies.assessment
      },
      { body: request.body, correlationId: parseCorrelationId(request.id), ownerUserId: principal.userId }
    );

    if (result.ok) {
      return reply
        .code(result.value.applied ? 201 : 200)
        .send({ applicationId: result.value.applicationId, request: result.value.request });
    }

    if (result.error.code === "wallet_required") {
      return reply.code(409).send({ code: "wallet_required" });
    }

    if (result.error.code === "invalid_request") {
      return reply.code(400).send({ errors: result.error.fieldErrors });
    }

    return reply.code(503).send({ code: "unavailable" });
  });

  app.get<{ Querystring: Record<string, unknown> }>("/sme-requests", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await listAdminSmeRequests(
      { repository: dependencies.repository },
      { query: request.query }
    );

    if (result.ok) {
      return reply.code(200).send(result.value);
    }

    return result.error.code === "invalid_request"
      ? reply.code(400).send({ code: "invalid_request" })
      : reply.code(503).send({ code: "unavailable" });
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

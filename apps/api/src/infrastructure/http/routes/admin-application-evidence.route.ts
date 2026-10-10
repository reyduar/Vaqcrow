import type { ApplicationId } from "@vaqcrow/contracts";
import { parseApplicationId } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { AdminApplicationEvidencePort } from "../../../application/ports/admin-application-evidence-port.js";
import { getAdminApplicationEvidence } from "../../../application/use-cases/get-admin-application-evidence.js";
import type { GetAdminApplicationEvidenceDependencies } from "../../../application/use-cases/get-admin-application-evidence.js";

export interface AdminApplicationEvidenceRouteDependencies {
  readonly evidence: Pick<AdminApplicationEvidencePort, "get">;
}

/**
 * `GET /application-reviews/:applicationId/evidence` (#438/WU2): the ADMIN's
 * read-only Testnet evidence chain for one application. Authorization is the
 * route-policy table (`only("ADMIN")`); errors leave as exactly `{ code }`.
 */
export function registerAdminApplicationEvidenceRoute(
  app: FastifyInstance,
  dependencies: AdminApplicationEvidenceRouteDependencies
): void {
  app.get<{ Params: { applicationId: string } }>(
    "/application-reviews/:applicationId/evidence",
    async (request, reply) => {
      let applicationId: ApplicationId;
      try {
        applicationId = parseApplicationId(request.params.applicationId);
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      try {
        const result = await dependencies.evidence.get(applicationId);
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
export function createAdminApplicationEvidenceRouteDependencies(
  dependencies: GetAdminApplicationEvidenceDependencies
): AdminApplicationEvidenceRouteDependencies {
  return { evidence: { get: (applicationId) => getAdminApplicationEvidence(dependencies, { applicationId }) } };
}

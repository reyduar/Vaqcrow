import { parseApplicationId, parseDocumentVerdictCommand, parsePymeDocumentId } from "@vaqcrow/contracts";
import type { ApplicationId, DocumentVerdictCommand } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { setDocumentVerdict } from "../../../application/use-cases/set-document-verdict.js";
import type {
  SetDocumentVerdictDependencies,
  SetDocumentVerdictRequest,
  SetDocumentVerdictResult
} from "../../../application/use-cases/set-document-verdict.js";

/** The route's single seam: a vendor-free function the composition root binds. */
export interface DocumentVerdictRouteDependencies {
  readonly set: (request: SetDocumentVerdictRequest) => Promise<SetDocumentVerdictResult>;
}

/**
 * Per-document KYC/KYB verdicts in the admin review (Feature #410, U1, D8).
 *
 * ADMIN-only by the route-policy table. The body carries only `{ verdict }`
 * (strict: an `actor` field is a 400, never silently ignored); the actor is the
 * verified principal. Errors are bare codes, never provider text.
 */
export function registerDocumentVerdictRoute(app: FastifyInstance, dependencies: DocumentVerdictRouteDependencies): void {
  app.put<{ Params: { applicationId: string; documentId: string }; Body: unknown }>(
    "/application-reviews/:applicationId/documents/:documentId/verdict",
    async (request, reply) => {
      const principal = request.principal;
      if (principal === undefined) {
        return reply.code(401).send({ code: "unauthenticated" });
      }

      let applicationId: ApplicationId;
      let documentId: string;
      let command: DocumentVerdictCommand;
      try {
        applicationId = parseApplicationId(request.params.applicationId);
        documentId = parsePymeDocumentId(request.params.documentId);
        command = parseDocumentVerdictCommand(request.body);
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      let result: SetDocumentVerdictResult;
      try {
        result = await dependencies.set({
          applicationId,
          documentId,
          verdict: command.verdict,
          actor: { userId: principal.userId, displayName: principal.displayName }
        });
      } catch {
        return reply.code(503).send({ code: "unavailable" });
      }

      if (result.ok) {
        return reply.code(200).send({ applied: result.value.applied, verdict: result.value.verdict });
      }

      switch (result.error.code) {
        case "not_found":
          return reply.code(404).send({ code: "not_found" });
        case "state_conflict":
          return reply.code(409).send({ code: "state_conflict", actualState: result.error.actualState });
        case "unavailable":
          return reply.code(503).send({ code: "unavailable" });
      }
    }
  );
}

/** Composition-root helper keeps the route's dependency a vendor-free function. */
export function createDocumentVerdictRouteDependencies(
  dependencies: SetDocumentVerdictDependencies
): DocumentVerdictRouteDependencies {
  return { set: (request) => setDocumentVerdict(dependencies, request) };
}

import type { FastifyInstance } from "fastify";
import { getMyDocuments, type GetMyDocumentsDependencies } from "../../../application/use-cases/get-my-documents.js";

/**
 * The PyME company post-submission surface (#530, T2).
 *
 * `GET /pyme-documents/mine` is `PYME`-only (see `route-policy.ts`) and returns
 * the metadata of the caller's own uploaded documents. The identity is always
 * `request.principal.userId`: any `owner` query parameter (or body) is ignored,
 * so a caller can only ever list its own documents.
 *
 * The response is metadata only — the storage object path is server-side and
 * never crosses the wire. A repository failure is a sanitized
 * `503 { code: "unavailable" }`, never a 200 with an empty but misleading list.
 */
export type MyDocumentsRouteDependencies = GetMyDocumentsDependencies;

export function registerMyDocumentsRoute(app: FastifyInstance, dependencies: MyDocumentsRouteDependencies): void {
  app.get("/pyme-documents/mine", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await getMyDocuments(dependencies, { ownerUserId: principal.userId });
    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send(result.value);
  });
}

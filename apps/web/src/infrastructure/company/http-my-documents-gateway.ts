import { myDocumentsReadSchema } from "@vaqcrow/contracts";
import { HttpClientError, type HttpClientPort } from "@/application/ports/http-client-port";
import type { MyDocumentsPort, MyDocumentsResult } from "@/application/ports/my-documents-port";

/**
 * HTTP adapter for the owner-scoped documents read (Feature #530, T5/S4):
 *   GET /pyme-documents/mine -> { documents: MyDocument[] }; PYME-only, owner-scoped
 *
 * The owner is resolved from the session's `Authorization: Bearer` token by the
 * API; no owner id ever travels from here. The response is metadata only and is
 * validated with the strict contract schema, so a leaked `objectPath` (or any
 * other unexpected key), a bad document id or kind is refused rather than
 * forwarded. A malformed success body is never trusted (it collapses to
 * `unavailable`), 401/403 are the session's `unauthenticated`, every other
 * non-200 the sanitized `unavailable`, and a transport failure `network`.
 */
export class HttpMyDocumentsGateway implements MyDocumentsPort {
  constructor(private readonly http: HttpClientPort) {}

  async listMine(): Promise<MyDocumentsResult> {
    try {
      const response = await this.http.send<unknown>({ method: "GET", path: "/pyme-documents/mine" });
      try {
        const parsed = myDocumentsReadSchema.parse(response.body);
        return { ok: true, documents: parsed.documents };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch (error) {
      if (error instanceof HttpClientError) {
        if (error.kind === "network") return { ok: false, code: "network" };
        if (error.status === 401 || error.status === 403) return { ok: false, code: "unauthenticated" };
      }
      return { ok: false, code: "unavailable" };
    }
  }
}

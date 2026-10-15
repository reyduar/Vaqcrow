import { myApplicationReadSchema, smeRequestReadSchema, smeRequestSubmissionSchema } from "@vaqcrow/contracts";
import { HttpClientError, type HttpClientPort } from "@/application/ports/http-client-port";
import type {
  MyApplicationOutcome,
  SmeRequestCurrent,
  SmeRequestGateway,
  SmeRequestSubmitted
} from "@/application/ports/sme-request-gateway";
import type { SmeRequest } from "@vaqcrow/contracts";

/**
 * HTTP adapter for the `apps/api` SME request contract:
 *   POST /sme-requests                  body: SmeRequest -> 201 (200 on replay) { applicationId, request }
 *   GET  /sme-requests/:applicationId   -> { request, salesPeriods, state }; 404 unknown id, 400 malformed id
 *   GET  /sme-requests/mine             -> { application: { applicationId, state } | null }; PYME-only, owner-scoped
 *   400 { errors: [{ field, code }] } and 503 { code: "unavailable" } (see AxiosHttpClient)
 * Responses are validated with the contract schemas; violations throw. `loadMine`
 * never throws: it maps a sanitized `HttpClientError` to the port's outcome codes.
 */
export class HttpSmeRequestGateway implements SmeRequestGateway {
  constructor(private readonly http: HttpClientPort) {}

  async submit(request: SmeRequest): Promise<SmeRequestSubmitted> {
    const response = await this.http.send<unknown>({ method: "POST", path: "/sme-requests", body: request });
    return smeRequestSubmissionSchema.parse(response.body);
  }

  async load(applicationId: string): Promise<SmeRequestCurrent> {
    const response = await this.http.send<unknown>({
      method: "GET",
      path: `/sme-requests/${encodeURIComponent(applicationId)}`
    });
    return smeRequestReadSchema.parse(response.body);
  }

  /**
   * The owner is resolved from the session's `Authorization: Bearer` token by
   * the API; no owner id ever travels from here. A malformed success body is
   * never trusted (it collapses to `unavailable`), 401/403 are the session's
   * `unauthenticated`, every other non-200 the sanitized `unavailable`, and a
   * transport failure `network`.
   */
  async loadMine(): Promise<MyApplicationOutcome> {
    try {
      const response = await this.http.send<unknown>({ method: "GET", path: "/sme-requests/mine" });
      try {
        const parsed = myApplicationReadSchema.parse(response.body);
        return { ok: true, application: parsed.application };
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

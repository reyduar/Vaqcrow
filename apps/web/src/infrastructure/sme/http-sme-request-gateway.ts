import { smeRequestReadSchema, smeRequestSubmissionSchema } from "@vaqcrow/contracts";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import type {
  SmeRequestCurrent,
  SmeRequestGateway,
  SmeRequestSubmitted
} from "@/application/ports/sme-request-gateway";
import type { SmeRequest } from "@vaqcrow/contracts";

/**
 * HTTP adapter for the `apps/api` SME request contract:
 *   POST /sme-requests                  body: SmeRequest -> 201 (200 on replay) { applicationId, request }
 *   GET  /sme-requests/:applicationId   -> { request, salesPeriods }; 404 unknown id, 400 malformed id
 *   400 { errors: [{ field, code }] } and 503 { code: "unavailable" } (see AxiosHttpClient)
 * Responses are validated with the contract schemas; violations throw.
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
}

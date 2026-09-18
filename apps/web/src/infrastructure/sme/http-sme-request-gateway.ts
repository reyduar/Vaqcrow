import { salesPeriodSchema, smeRequestSchema } from "@vaqcrow/contracts";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import type { SmeRequestCurrent, SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import type { SmeRequest } from "@vaqcrow/contracts";

/**
 * ASSUMPTION: `apps/api` has no SME endpoints yet. These paths and the
 * response envelopes are documented placeholders for the future backend:
 *   POST /sme-requests          body: SmeRequest          -> SmeRequest
 *   GET  /sme-requests/current  -> { request: SmeRequest | null, salesPeriods: SalesPeriod[] }
 *   4xx  errors                 -> { errors: [{ field, code }] } (see AxiosHttpClient)
 * Responses are validated with the contract schemas; violations throw.
 */
function parseCurrent(body: unknown): SmeRequestCurrent {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new TypeError("Invalid current SME request envelope");
  }
  const { request, salesPeriods, ...extra } = body as Record<string, unknown>;
  if (Object.keys(extra).length > 0 || !Array.isArray(salesPeriods)) {
    throw new TypeError("Invalid current SME request envelope");
  }
  return {
    request: request === null ? null : smeRequestSchema.parse(request),
    salesPeriods: (salesPeriods as unknown[]).map((period) => salesPeriodSchema.parse(period))
  };
}

export class HttpSmeRequestGateway implements SmeRequestGateway {
  constructor(private readonly http: HttpClientPort) {}

  async submit(request: SmeRequest): Promise<SmeRequest> {
    const response = await this.http.send<unknown>({ method: "POST", path: "/sme-requests", body: request });
    return smeRequestSchema.parse(response.body);
  }

  async loadCurrent(): Promise<SmeRequestCurrent> {
    const response = await this.http.send<unknown>({ method: "GET", path: "/sme-requests/current" });
    return parseCurrent(response.body);
  }
}

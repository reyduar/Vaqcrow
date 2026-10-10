import axios, { type AxiosInstance } from "axios";
import { parseReportSalesByPyme } from "@vaqcrow/contracts";
import type { ReportSalesPort, ReportSalesResult } from "@/application/ports/report-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { bearerHeaders, rangeParams, resolveImageSrc } from "./http-shared";

/**
 * HTTP adapter for `GET /reports/sales-by-pyme` (Feature #430, WU2). The block
 * is fetched on its own so the web can render its own partial-error state. The
 * contract keeps `imageUrl` API-relative, so this adapter resolves it against
 * the configured API base into the absolute `imageSrc` the DOM needs; `null`
 * stays `null` and an unresolvable reference is also `null` (an image is
 * decoration, not data). Error mapping mirrors `HttpReportGateway`.
 */
export class HttpReportSalesGateway implements ReportSalesPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly imageBaseUrl: string,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpReportSalesGateway {
    return new HttpReportSalesGateway(
      axios.create({ baseURL: baseUrl, validateStatus: () => true }),
      baseUrl,
      accessToken
    );
  }

  async get(from: string | null, to: string | null): Promise<ReportSalesResult> {
    const headers = await bearerHeaders(this.accessToken);
    try {
      const response = await this.client.get("/reports/sales-by-pyme", {
        params: rangeParams(from, to),
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status === 401 || response.status === 403) return { ok: false, code: "unauthenticated" };
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      try {
        const parsed = parseReportSalesByPyme(response.data);
        return {
          ok: true,
          sales: {
            pymes: parsed.pymes.map((pyme) => ({
              name: pyme.name,
              sector: pyme.sector,
              imageSrc: resolveImageSrc(pyme.imageUrl, this.imageBaseUrl),
              period: pyme.period,
              salesArs: pyme.salesArs,
              status: pyme.status
            }))
          }
        };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch {
      return { ok: false, code: "network" };
    }
  }
}

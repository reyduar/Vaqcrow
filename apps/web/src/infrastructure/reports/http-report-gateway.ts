import axios, { type AxiosInstance } from "axios";
import { parseInvestorReport } from "@vaqcrow/contracts";
import type { ReportPort, ReportResult } from "@/application/ports/report-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { bearerHeaders, rangeParams } from "./http-shared";

/**
 * HTTP adapter for `GET /reports` (Feature #430, WU2) with the signed-in
 * session's `Authorization: Bearer` token. The investor is resolved from that
 * token by the API, so no account id or user id ever travels from here. The
 * wire body is validated by the shared contract parser; a malformed success
 * body collapses to `unavailable`, 401/403 are the session's `unauthenticated`,
 * every other non-200 the sanitized `unavailable`, and a transport failure
 * `network`.
 */
export class HttpReportGateway implements ReportPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpReportGateway {
    return new HttpReportGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  async get(from: string | null, to: string | null): Promise<ReportResult> {
    const headers = await bearerHeaders(this.accessToken);
    try {
      const response = await this.client.get("/reports", {
        params: rangeParams(from, to),
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status === 401 || response.status === 403) return { ok: false, code: "unauthenticated" };
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      try {
        const parsed = parseInvestorReport(response.data);
        return {
          ok: true,
          report: {
            range: parsed.range,
            availableRange: parsed.availableRange,
            isEmpty: parsed.isEmpty,
            kpis: parsed.kpis,
            monthlySeries: parsed.monthlySeries,
            latestDistributions: parsed.latestDistributions,
            contributionTransactions: parsed.contributionTransactions
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

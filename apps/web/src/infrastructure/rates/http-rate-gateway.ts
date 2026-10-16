import axios, { type AxiosInstance } from "axios";
import type { RateErrorCode, RatePort, RateResult } from "@/application/ports/rate-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the current FX rate (#572), talking to `GET /rates/current`
 * with the signed-in session's `Authorization: Bearer` token.
 *
 * 404 is `not_found` (no rate in effect), 401/403 collapse to `unauthenticated`,
 * every other non-200 is `unavailable`; a success body whose rate is not two
 * non-negative integer strings is `unavailable`, never a made-up rate; a
 * transport failure is `network`.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;
const INTEGER_PATTERN = /^\d+$/;

function statusCode(status: number): RateErrorCode {
  if (status === 404) return "not_found";
  return status === 401 || status === 403 ? "unauthenticated" : "unavailable";
}

async function headersFor(provider: AccessTokenProvider | undefined): Promise<Record<string, string> | undefined> {
  if (!provider) return undefined;
  let token: string | null;
  try {
    token = await provider();
  } catch {
    // No token is not a transport failure: the request goes out unauthenticated
    // and the API answers 401, which is mapped above.
    return undefined;
  }
  return typeof token === "string" && BEARER_TOKEN_PATTERN.test(token) ? { Authorization: `Bearer ${token}` } : undefined;
}

function parseRate(data: unknown): RateResult {
  const rate = (data as { rate?: unknown } | null)?.rate as Record<string, unknown> | undefined;
  const usdToArs = rate?.["usdToArs"];
  const stroopsPerUsd = rate?.["stroopsPerUsd"];
  if (typeof usdToArs !== "string" || typeof stroopsPerUsd !== "string") return { ok: false, code: "unavailable" };
  if (!INTEGER_PATTERN.test(usdToArs) || !INTEGER_PATTERN.test(stroopsPerUsd)) return { ok: false, code: "unavailable" };
  return { ok: true, rate: { usdToArs: BigInt(usdToArs), stroopsPerUsd: BigInt(stroopsPerUsd) } };
}

export class HttpRateGateway implements RatePort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpRateGateway {
    return new HttpRateGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  async getCurrent(): Promise<RateResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/rates/current", {
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status !== 200) return { ok: false, code: statusCode(response.status) };
      return parseRate(response.data);
    } catch {
      return { ok: false, code: "network" };
    }
  }
}

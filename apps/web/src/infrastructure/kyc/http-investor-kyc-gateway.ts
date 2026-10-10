import axios, { type AxiosInstance } from "axios";
import { parseInvestorKyc } from "@vaqcrow/contracts";
import type { InvestorKycErrorCode, InvestorKycPort, InvestorKycResult } from "@/application/ports/investor-kyc-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the investor's simulated KYC (Feature #422, WU4) talking to
 * `GET /investor-kyc` and `POST /investor-kyc` with the signed-in session's
 * `Authorization: Bearer` token. The owner is resolved from that token, so no
 * user travels from here.
 *
 * 401/403 collapse to `unauthenticated` (a session the UI can act on); every
 * other non-2xx is `unavailable`; a malformed success body is `unavailable`; a
 * transport failure is `network`. `POST` answers 201 on create and 200 on a
 * replay — both are success.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

/** 401/403 mean "the caller is not a valid principal"; anything else is a service failure. */
function statusCode(status: number): InvestorKycErrorCode {
  return status === 401 || status === 403 ? "unauthenticated" : "unavailable";
}

async function headersFor(provider: AccessTokenProvider | undefined): Promise<Record<string, string> | undefined> {
  if (!provider) return undefined;
  let token: string | null;
  try {
    token = await provider();
  } catch {
    // No token is not a transport failure: the request goes out unauthenticated
    // and the API answers 401, which is mapped below.
    return undefined;
  }
  return typeof token === "string" && BEARER_TOKEN_PATTERN.test(token) ? { Authorization: `Bearer ${token}` } : undefined;
}

export class HttpInvestorKycGateway implements InvestorKycPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpInvestorKycGateway {
    return new HttpInvestorKycGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  get(): Promise<InvestorKycResult> {
    return this.request("get");
  }

  approve(): Promise<InvestorKycResult> {
    return this.request("post");
  }

  private async request(method: "get" | "post"): Promise<InvestorKycResult> {
    const headers = await headersFor(this.accessToken);
    const config = { ...(headers ? { headers } : {}), validateStatus: () => true };
    try {
      const response =
        method === "get"
          ? await this.client.get("/investor-kyc", config)
          : await this.client.post("/investor-kyc", undefined, config);
      if (response.status !== 200 && response.status !== 201) {
        return { ok: false, code: statusCode(response.status) };
      }
      try {
        return { ok: true, status: parseInvestorKyc(response.data) };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch {
      return { ok: false, code: "network" };
    }
  }
}

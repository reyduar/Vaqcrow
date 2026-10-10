import axios, { type AxiosInstance } from "axios";
import type {
  SalesDeclarationErrorCode,
  SalesDeclarationPeriod,
  SalesDeclarationPort,
  SalesDeclarationResult
} from "@/application/ports/sales-declaration-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the PyME monthly sales declaration (Feature #434, WU3)
 * talking to `POST /businesses/:businessId/sales-periods` with the signed-in
 * session's `Authorization: Bearer` token. The owner is resolved from that
 * token by the API, so this adapter never sends an identity — the body is
 * exactly `{ periods }`.
 *
 * The declared path always answers `200` on success; every other status is the
 * sanitized API code, and a transport failure is `network`. Response bodies and
 * provider messages never cross this boundary.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

async function headersFor(provider: AccessTokenProvider | undefined): Promise<Record<string, string> | undefined> {
  if (!provider) return undefined;
  let token: string | null;
  try {
    token = await provider();
  } catch {
    // No token is not a transport failure: the request goes out unauthenticated
    // and the API answers 401, which is mapped to `unauthenticated`.
    return undefined;
  }
  return typeof token === "string" && BEARER_TOKEN_PATTERN.test(token) ? { Authorization: `Bearer ${token}` } : undefined;
}

function codeForStatus(status: number): SalesDeclarationErrorCode {
  if (status === 400) return "invalid_request";
  if (status === 401 || status === 403) return "unauthenticated";
  if (status === 404) return "not_found";
  return "unavailable";
}

export class HttpSalesDeclarationGateway implements SalesDeclarationPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpSalesDeclarationGateway {
    return new HttpSalesDeclarationGateway(
      axios.create({ baseURL: baseUrl, validateStatus: () => true }),
      accessToken
    );
  }

  async declare(
    businessId: string,
    periods: readonly SalesDeclarationPeriod[]
  ): Promise<SalesDeclarationResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.post(
        `/businesses/${encodeURIComponent(businessId)}/sales-periods`,
        { periods },
        { ...(headers ? { headers } : {}), validateStatus: () => true }
      );
      if (response.status === 200) return { ok: true };
      return { ok: false, code: codeForStatus(response.status) };
    } catch {
      return { ok: false, code: "network" };
    }
  }
}

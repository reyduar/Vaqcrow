import axios, { type AxiosInstance } from "axios";
import { parseFavoriteCampaignList, parseFavoriteCampaignResult } from "@vaqcrow/contracts";
import type { FavoriteErrorCode, FavoriteListResult, FavoritePort, FavoriteToggleResult } from "@/application/ports/favorite-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for favorites (Feature #414, WU4a) talking to `GET /favorites`
 * and `PUT`/`DELETE /favorites/:campaignId` with the signed-in session's
 * `Authorization: Bearer` token. The owner is resolved from that token, so no
 * recipient travels from here.
 *
 * 401/403 collapse to `unauthenticated` (a session the UI can act on); every
 * other non-200 is `unavailable`; a malformed success body is `unavailable`; a
 * transport failure is `network`.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

/** 401/403 mean "the caller is not a valid principal"; anything else is a service failure. */
function statusCode(status: number): FavoriteErrorCode {
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

export class HttpFavoriteGateway implements FavoritePort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpFavoriteGateway {
    return new HttpFavoriteGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  async list(): Promise<FavoriteListResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/favorites", {
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status !== 200) return { ok: false, code: statusCode(response.status) };
      try {
        return { ok: true, campaignIds: parseFavoriteCampaignList(response.data).campaignIds };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch {
      return { ok: false, code: "network" };
    }
  }

  add(campaignId: string): Promise<FavoriteToggleResult> {
    return this.write("put", campaignId);
  }

  remove(campaignId: string): Promise<FavoriteToggleResult> {
    return this.write("delete", campaignId);
  }

  private async write(method: "put" | "delete", campaignId: string): Promise<FavoriteToggleResult> {
    const headers = await headersFor(this.accessToken);
    const config = { ...(headers ? { headers } : {}), validateStatus: () => true };
    const url = `/favorites/${campaignId}`;
    try {
      const response =
        method === "put" ? await this.client.put(url, undefined, config) : await this.client.delete(url, config);
      if (response.status !== 200) return { ok: false, code: statusCode(response.status) };
      try {
        return { ok: true, applied: parseFavoriteCampaignResult(response.data).applied };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch {
      return { ok: false, code: "network" };
    }
  }
}

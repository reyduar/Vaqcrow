import axios, { type AxiosInstance } from "axios";
import { parseMyCampaigns, type MyCampaign as MyCampaignWire } from "@vaqcrow/contracts";
import type { MyCampaign, MyCampaignsPort, MyCampaignsResult } from "@/application/ports/my-campaigns-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the PyME dashboard (Feature #434, WU2) talking to
 * `GET /my-campaigns` with the signed-in session's `Authorization: Bearer`
 * token. The owner is resolved from that token by the API, so no owner id or
 * user id ever travels from here.
 *
 * The wire contract keeps `imageUrl` API-relative, so this adapter resolves it
 * against the configured API base into the absolute `imageSrc` the DOM needs;
 * `null` stays `null` and an unresolvable reference is also `null` (an image is
 * decoration, not data — it never invalidates the whole payload). A malformed
 * success body collapses to `unavailable`; 401/403 are the session's
 * `unauthenticated`, every other non-200 the sanitized `unavailable`, and a
 * transport failure `network`.
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

/** Resolves the contract's API-relative image path to an absolute URL; anything unresolvable is `null`. */
function resolveImageSrc(imageUrl: string | null, imageBaseUrl: string): string | null {
  if (imageUrl === null) return null;
  try {
    return new URL(imageUrl, imageBaseUrl).toString();
  } catch {
    return null;
  }
}

function toCampaign(wire: MyCampaignWire, imageBaseUrl: string): MyCampaign {
  return {
    campaignId: wire.campaignId,
    name: wire.name,
    sector: wire.sector,
    city: wire.city,
    imageSrc: resolveImageSrc(wire.imageUrl, imageBaseUrl),
    vaultAddress: wire.vaultAddress,
    vaultExplorerUrl: wire.vaultExplorerUrl,
    state: wire.state,
    goalArs: wire.goalArs,
    raisedArs: wire.raisedArs,
    fundedPercentBps: wire.fundedPercentBps,
    deadline: wire.deadline,
    contributorsCount: wire.contributorsCount,
    distributions: wire.distributions,
    sales: wire.sales
  };
}

export class HttpMyCampaignsGateway implements MyCampaignsPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly imageBaseUrl: string,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpMyCampaignsGateway {
    return new HttpMyCampaignsGateway(
      axios.create({ baseURL: baseUrl, validateStatus: () => true }),
      baseUrl,
      accessToken
    );
  }

  async get(): Promise<MyCampaignsResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/my-campaigns", {
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status === 401 || response.status === 403) return { ok: false, code: "unauthenticated" };
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      try {
        const parsed = parseMyCampaigns(response.data);
        return {
          ok: true,
          myCampaigns: { campaigns: parsed.campaigns.map((campaign) => toCampaign(campaign, this.imageBaseUrl)) }
        };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch {
      return { ok: false, code: "network" };
    }
  }
}

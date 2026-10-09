import axios, { type AxiosInstance } from "axios";
import { parseCampaignDetail, type CampaignDetail as CampaignDetailWire } from "@vaqcrow/contracts";
import type {
  CampaignDetail,
  CampaignDetailErrorCode,
  CampaignDetailPort,
  CampaignDetailResult
} from "@/application/ports/campaign-detail-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the account-gated campaign detail (Feature #422, WU2) talking
 * to `GET /marketplace/campaigns/:campaignId` with the signed-in session's
 * `Authorization: Bearer` token. The owner is resolved from that token by the
 * API, so no principal ever travels from here.
 *
 * The wire contract keeps `imageUrl` API-relative, so this adapter resolves it
 * against the configured API base into the absolute `imageSrc` the DOM needs. A
 * malformed success body (or an image that cannot be resolved against a broken
 * base) collapses to `unavailable` instead of rendering; 401/403 are the
 * session's `unauthenticated`, 404 the campaign's `not_found`, every other
 * non-200 the sanitized `unavailable`, and a transport failure `network`.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

/** 401/403 mean "the caller is not a valid principal"; 404 names no published campaign. */
function statusCode(status: number): CampaignDetailErrorCode {
  if (status === 401 || status === 403) return "unauthenticated";
  if (status === 404) return "not_found";
  return "unavailable";
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

/**
 * Resolves the contract's API-relative image path to an absolute URL. `null`
 * stays `null`; an unresolvable value is `undefined` so the caller can treat the
 * whole payload as malformed.
 */
function resolveImageSrc(imageUrl: string | null, imageBaseUrl: string): string | null | undefined {
  if (imageUrl === null) return null;
  try {
    return new URL(imageUrl, imageBaseUrl).toString();
  } catch {
    return undefined;
  }
}

function toDetail(wire: CampaignDetailWire, imageBaseUrl: string): CampaignDetail | undefined {
  const imageSrc = resolveImageSrc(wire.imageUrl, imageBaseUrl);
  if (imageSrc === undefined) return undefined;
  return {
    campaignId: wire.campaignId,
    name: wire.name,
    sector: wire.sector,
    city: wire.city,
    description: wire.description,
    foundedAt: wire.foundedAt,
    goalArs: wire.goalArs,
    raisedArs: wire.raisedArs,
    fundedPercentBps: wire.fundedPercentBps,
    revenueShare: wire.revenueShare,
    riskBand: wire.riskBand,
    riskConfidence: wire.riskConfidence,
    closeDate: wire.closeDate,
    imageSrc,
    status: wire.status,
    backers: wire.backers,
    vaultAddress: wire.vaultAddress,
    assessment: wire.assessment,
    decision: wire.decision
  };
}

export class HttpCampaignDetailGateway implements CampaignDetailPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly imageBaseUrl: string,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpCampaignDetailGateway {
    return new HttpCampaignDetailGateway(
      axios.create({ baseURL: baseUrl, validateStatus: () => true }),
      baseUrl,
      accessToken
    );
  }

  async get(campaignId: string): Promise<CampaignDetailResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get(`/marketplace/campaigns/${campaignId}`, {
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status !== 200) return { ok: false, code: statusCode(response.status) };
      try {
        const detail = toDetail(parseCampaignDetail(response.data), this.imageBaseUrl);
        if (!detail) return { ok: false, code: "unavailable" };
        return { ok: true, detail };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch {
      return { ok: false, code: "network" };
    }
  }
}

import axios, { type AxiosInstance } from "axios";
import { parsePortfolioSummary, type PortfolioPosition as PortfolioPositionWire } from "@vaqcrow/contracts";
import type { PortfolioPort, PortfolioResult } from "@/application/ports/portfolio-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the investor portfolio (Feature #426, WU2) talking to
 * `GET /portfolio` with the signed-in session's `Authorization: Bearer` token.
 * The investor is resolved from that token by the API, so no account id or user
 * id ever travels from here.
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

function toPosition(wire: PortfolioPositionWire, imageBaseUrl: string) {
  return {
    campaignId: wire.campaignId,
    name: wire.name,
    sector: wire.sector,
    city: wire.city,
    imageSrc: resolveImageSrc(wire.imageUrl, imageBaseUrl),
    contributionXlm: wire.contributionXlm,
    raisedArs: wire.raisedArs,
    goalArs: wire.goalArs,
    fundedPercentBps: wire.fundedPercentBps,
    status: wire.status,
    closeDate: wire.closeDate,
    vaultAddress: wire.vaultAddress,
    vaultExplorerUrl: wire.vaultExplorerUrl,
    transactions: wire.transactions
  } as const;
}

export class HttpPortfolioGateway implements PortfolioPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly imageBaseUrl: string,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpPortfolioGateway {
    return new HttpPortfolioGateway(
      axios.create({ baseURL: baseUrl, validateStatus: () => true }),
      baseUrl,
      accessToken
    );
  }

  async get(): Promise<PortfolioResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/portfolio", {
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status === 401 || response.status === 403) return { ok: false, code: "unauthenticated" };
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      try {
        const parsed = parsePortfolioSummary(response.data);
        return {
          ok: true,
          summary: {
            contributions: parsed.contributions.map((position) => toPosition(position, this.imageBaseUrl)),
            distributions: parsed.distributions,
            totals: parsed.totals
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

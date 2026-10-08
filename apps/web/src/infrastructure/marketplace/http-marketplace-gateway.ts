import axios, { type AxiosInstance } from "axios";
import { parseMarketplaceCampaignList, type MarketplaceCampaign } from "@vaqcrow/contracts";
import type { MarketplaceCard, MarketplaceListResult, MarketplacePort } from "@/application/ports/marketplace-port";

/**
 * HTTP adapter for the public marketplace (Feature #414, WU4a) talking to
 * `GET /marketplace/campaigns`. No auth: the route is public.
 *
 * The wire contract keeps `imageUrl` API-relative, so this adapter resolves it
 * against the configured API base into the absolute `imageSrc` the DOM needs. A
 * malformed success body (or an image that cannot be resolved against a broken
 * base) collapses to `unavailable` instead of rendering; a transport failure is
 * `network`; every non-200 status is the sanitized `unavailable`.
 */

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

function toCard(item: MarketplaceCampaign, imageBaseUrl: string): MarketplaceCard | undefined {
  const imageSrc = resolveImageSrc(item.imageUrl, imageBaseUrl);
  if (imageSrc === undefined) return undefined;
  return {
    campaignId: item.campaignId,
    name: item.name,
    sector: item.sector,
    city: item.city,
    goalArs: item.goalArs,
    raisedArs: item.raisedArs,
    fundedPercentBps: item.fundedPercentBps,
    revenueShare: item.revenueShare,
    riskBand: item.riskBand,
    riskConfidence: item.riskConfidence,
    closeDate: item.closeDate,
    imageSrc
  };
}

export class HttpMarketplaceGateway implements MarketplacePort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly imageBaseUrl: string
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string): HttpMarketplaceGateway {
    return new HttpMarketplaceGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), baseUrl);
  }

  async list(): Promise<MarketplaceListResult> {
    try {
      const response = await this.client.get("/marketplace/campaigns", { validateStatus: () => true });
      if (response.status !== 200) return { ok: false, code: "unavailable" };

      let parsed;
      try {
        parsed = parseMarketplaceCampaignList(response.data);
      } catch {
        return { ok: false, code: "unavailable" };
      }

      const items: MarketplaceCard[] = [];
      for (const item of parsed.items) {
        const card = toCard(item, this.imageBaseUrl);
        if (!card) return { ok: false, code: "unavailable" };
        items.push(card);
      }
      return { ok: true, items };
    } catch {
      return { ok: false, code: "network" };
    }
  }
}

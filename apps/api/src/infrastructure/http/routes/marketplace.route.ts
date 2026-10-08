import type { FastifyInstance } from "fastify";
import type { MarketplaceCampaignRepositoryPort } from "../../../application/ports/marketplace-campaign-repository-port.js";
import { listMarketplaceCampaigns } from "../../../application/use-cases/list-marketplace-campaigns.js";

/**
 * The public marketplace surface (#414/WU1).
 *
 * `GET /marketplace/campaigns` is PUBLIC (no token): it lists every published
 * campaign — a confirmed vault deployment on an `open` campaign — as one
 * unpaginated `{ items }` list (owner decision D3). The response is public and
 * volatile (a campaign's `raised` moves), so it carries a short
 * `Cache-Control` for the CDN/browser, never a long-lived one. A repository
 * failure is a sanitized `503`, never an empty-but-successful list.
 */
export interface MarketplaceRouteDependencies {
  readonly campaigns: Pick<MarketplaceCampaignRepositoryPort, "listPublished">;
}

/** Short, revalidating window: the listing is public but changes as campaigns fund. */
const CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=30";

export function registerMarketplaceRoute(app: FastifyInstance, dependencies: MarketplaceRouteDependencies): void {
  app.get("/marketplace/campaigns", async (_request, reply) => {
    const result = await listMarketplaceCampaigns({ repository: dependencies.campaigns });

    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.header("cache-control", CACHE_CONTROL).code(200).send(result.value);
  });
}

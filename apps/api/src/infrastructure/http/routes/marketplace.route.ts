import { campaignIdSchema } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { CampaignDetailRepositoryPort } from "../../../application/ports/campaign-detail-repository-port.js";
import type { MarketplaceCampaignRepositoryPort } from "../../../application/ports/marketplace-campaign-repository-port.js";
import type { StoragePort } from "../../../application/ports/storage-port.js";
import { getCampaignDetail } from "../../../application/use-cases/get-campaign-detail.js";
import { getMarketplaceCampaignImage } from "../../../application/use-cases/get-marketplace-campaign-image.js";
import { listMarketplaceCampaigns } from "../../../application/use-cases/list-marketplace-campaigns.js";

/**
 * The public marketplace surface (#414/WU1/WU3).
 *
 * `GET /marketplace/campaigns` is PUBLIC (no token): it lists every published
 * campaign — a confirmed vault deployment on an `open` campaign — as one
 * unpaginated `{ items }` list (owner decision D3). The response is public and
 * volatile (a campaign's `raised` moves), so it carries a short
 * `Cache-Control` for the CDN/browser, never a long-lived one. A repository
 * failure is a sanitized `503`, never an empty-but-successful list.
 *
 * `GET /marketplace/campaigns/:campaignId/image` is PUBLIC too: it proxies the
 * first image document of a published campaign's PyME from the private bucket
 * through the shared `StoragePort`. The object path and any storage URL never
 * cross the wire; a campaign that is not published or has no image is a `404`,
 * and a repository/storage failure is a sanitized `503`.
 *
 * `GET /marketplace/campaigns/:campaignId` is the account-gated campaign detail
 * (#422/WU1): it requires a session (any role, see `route-policy.ts`) and only
 * serves a **published** campaign. A non-UUID id is a `400`, an unpublished or
 * unknown campaign a `404`, and a repository failure a sanitized `503`. It is
 * registered only when the detail repository is wired.
 */
export interface MarketplaceRouteDependencies {
  readonly campaigns: Pick<MarketplaceCampaignRepositoryPort, "listPublished" | "findPublishedImage">;
  readonly storage: Pick<StoragePort, "downloadObject">;
  /** The account-gated campaign detail read model (#422/WU1). Omitted when unwired. */
  readonly detail?: Pick<CampaignDetailRepositoryPort, "findPublished"> | undefined;
  /**
   * `StellarConfig.explorerUrl`, used by the detail to link the vault
   * (#438/WU3); `undefined` on the `local` network, which makes the link `null`.
   */
  readonly explorerBaseUrl: string | undefined;
}

/** Short, revalidating window: the listing is public but changes as campaigns fund. */
const CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=30";

/**
 * The image bytes are immutable per path (a new upload is a new path), so they
 * can be cached longer than the volatile listing.
 */
const IMAGE_CACHE_CONTROL = "public, max-age=300";

export function registerMarketplaceRoute(app: FastifyInstance, dependencies: MarketplaceRouteDependencies): void {
  app.get("/marketplace/campaigns", async (_request, reply) => {
    const result = await listMarketplaceCampaigns({ repository: dependencies.campaigns });

    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.header("cache-control", CACHE_CONTROL).code(200).send(result.value);
  });

  app.get<{ Params: { campaignId: string } }>(
    "/marketplace/campaigns/:campaignId/image",
    async (request, reply) => {
      // A malformed id is a 404, not a 400: the route only ever speaks about a
      // campaign that exists and is published, and a bad id names no campaign.
      const parsed = campaignIdSchema.safeParse(request.params.campaignId);
      if (!parsed.success) {
        return reply.code(404).send({ code: "not_found" });
      }

      const result = await getMarketplaceCampaignImage(
        { repository: dependencies.campaigns, storage: dependencies.storage },
        parsed.data
      );

      if (!result.ok) {
        return result.error.code === "not_found"
          ? reply.code(404).send({ code: "not_found" })
          : reply.code(503).send({ code: "unavailable" });
      }

      return reply
        .header("Cache-Control", IMAGE_CACHE_CONTROL)
        .header("Content-Disposition", "inline")
        .header("X-Content-Type-Options", "nosniff")
        .type(result.value.contentType)
        .send(Buffer.from(result.value.bytes));
    }
  );

  if (dependencies.detail !== undefined) {
    const detail = dependencies.detail;
    app.get<{ Params: { campaignId: string } }>("/marketplace/campaigns/:campaignId", async (request, reply) => {
      // A malformed id is a 400 here (unlike the image route's 404): the detail
      // route is reachable by any signed-in caller and a bad id is a bad request,
      // not a campaign that does not exist.
      const parsed = campaignIdSchema.safeParse(request.params.campaignId);
      if (!parsed.success) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await getCampaignDetail(
        { repository: detail, explorerBaseUrl: dependencies.explorerBaseUrl },
        parsed.data
      );
      if (!result.ok) {
        return result.error.code === "not_found"
          ? reply.code(404).send({ code: "not_found" })
          : reply.code(503).send({ code: "unavailable" });
      }

      return reply.code(200).send(result.value);
    });
  }
}

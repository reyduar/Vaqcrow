import type { MarketplaceCampaignRepositoryPort } from "../ports/marketplace-campaign-repository-port.js";
import type { StoragePort } from "../ports/storage-port.js";

/**
 * The public campaign image (#414/WU3).
 *
 * It resolves the first image document of a **published** campaign through the
 * marketplace repository, then reads its bytes through the shared `StoragePort`
 * — the same port and adapter the content-relevance check uses, so there is no
 * second storage client. The object path never crosses the use case boundary:
 * the caller receives bytes plus the stored content type only.
 *
 * A campaign that is not published, or carries no image, is `not_found`. Every
 * server-side failure — a repository error or a storage read failure — is
 * `unavailable`, never a 200 with no bytes.
 */

export interface GetMarketplaceCampaignImageDependencies {
  readonly repository: Pick<MarketplaceCampaignRepositoryPort, "findPublishedImage">;
  readonly storage: Pick<StoragePort, "downloadObject">;
}

export interface MarketplaceCampaignImage {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export type GetMarketplaceCampaignImageResult =
  | { readonly ok: true; readonly value: MarketplaceCampaignImage }
  | { readonly ok: false; readonly error: { readonly code: "not_found" | "unavailable" } };

export async function getMarketplaceCampaignImage(
  dependencies: GetMarketplaceCampaignImageDependencies,
  campaignId: string
): Promise<GetMarketplaceCampaignImageResult> {
  const found = await dependencies.repository.findPublishedImage(campaignId);
  if (!found.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }
  if (found.value === undefined) {
    return { ok: false, error: { code: "not_found" } };
  }

  const downloaded = await dependencies.storage.downloadObject(found.value.objectPath);
  if (!downloaded.ok) {
    // The descriptor says an image exists but its bytes cannot be read; that is
    // a server-side failure, never a client "no image".
    return { ok: false, error: { code: "unavailable" } };
  }

  // The stored content type was validated at upload and constrained to
  // `image/jpeg`/`image/png` by the view; the bytes are the payload.
  return {
    ok: true,
    value: { bytes: downloaded.value.bytes, contentType: found.value.contentType }
  };
}

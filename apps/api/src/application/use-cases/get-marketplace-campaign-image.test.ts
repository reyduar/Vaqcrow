import { describe, expect, it } from "vitest";
import type { MarketplaceCampaignRepositoryPort } from "../ports/marketplace-campaign-repository-port.js";
import type { StoragePort } from "../ports/storage-port.js";
import { getMarketplaceCampaignImage } from "./get-marketplace-campaign-image.js";

/**
 * The public campaign-image use case (#414/WU3). It resolves the first image
 * document of a **published** campaign through the repository, then reads the
 * bytes through the shared `StoragePort`. A missing campaign/image is
 * `not_found`; every server-side failure (repository or storage) is
 * `unavailable`, never a 200 with no bytes and never a leaked object path.
 */
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const OBJECT_PATH = "123e4567-e89b-42d3-a456-426614174000/photo/abc-panaderia.jpg";

function repository(
  value: Awaited<ReturnType<MarketplaceCampaignRepositoryPort["findPublishedImage"]>>
): Pick<MarketplaceCampaignRepositoryPort, "findPublishedImage"> {
  return { findPublishedImage: async () => value };
}

function storage(
  value: Awaited<ReturnType<StoragePort["downloadObject"]>>
): Pick<StoragePort, "downloadObject"> {
  return { downloadObject: async () => value };
}

describe("getMarketplaceCampaignImage", () => {
  it("reads the bytes through the storage port for a published campaign with an image", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

    const result = await getMarketplaceCampaignImage(
      {
        repository: repository({ ok: true, value: { objectPath: OBJECT_PATH, contentType: "image/jpeg" } }),
        storage: storage({ ok: true, value: { bytes, contentType: "image/jpeg" } })
      },
      CAMPAIGN_ID
    );

    expect(result).toEqual({ ok: true, value: { bytes, contentType: "image/jpeg" } });
  });

  it("is not_found when the campaign is not published or has no image, without reading storage", async () => {
    let storageCalled = false;

    const result = await getMarketplaceCampaignImage(
      {
        repository: repository({ ok: true, value: undefined }),
        storage: {
          downloadObject: async () => {
            storageCalled = true;
            return { ok: true as const, value: { bytes: new Uint8Array(), contentType: "image/png" } };
          }
        }
      },
      CAMPAIGN_ID
    );

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(storageCalled).toBe(false);
  });

  it("is unavailable when the repository is unavailable", async () => {
    const result = await getMarketplaceCampaignImage(
      {
        repository: repository({ ok: false, error: { code: "unavailable" } }),
        storage: storage({ ok: true, value: { bytes: new Uint8Array(), contentType: "image/png" } })
      },
      CAMPAIGN_ID
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("is unavailable on any storage failure, never a 200 with no bytes", async () => {
    for (const code of ["unavailable", "not_found", "invalid_path"] as const) {
      const result = await getMarketplaceCampaignImage(
        {
          repository: repository({ ok: true, value: { objectPath: OBJECT_PATH, contentType: "image/jpeg" } }),
          storage: storage({ ok: false, error: { code } })
        },
        CAMPAIGN_ID
      );

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    }
  });
});

import { parseMarketplaceCampaignList } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type {
  MarketplaceCampaignRecord,
  MarketplaceCampaignRepositoryPort
} from "../../../application/ports/marketplace-campaign-repository-port.js";
import type { StoragePort } from "../../../application/ports/storage-port.js";
import { buildApp } from "../build-app.js";
import { fakeAuthPort } from "../test-support/auth.js";
import type { MarketplaceRouteDependencies } from "./marketplace.route.js";

/**
 * The public marketplace surface (#414/WU1/WU3).
 *
 * `GET /marketplace/campaigns` serves the published-campaign cards and
 * `GET /marketplace/campaigns/:campaignId/image` proxies the PyME's real photo
 * from the private bucket. Both need no token; a repository or storage failure
 * is a sanitized 503, never an empty-but-successful list and never a 200 with
 * no bytes. The image endpoint never exposes the object path or a storage URL.
 */
const RECORD: MarketplaceCampaignRecord = {
  campaignId: "123e4567-e89b-42d3-a456-426614174000",
  name: "Panadería Sol",
  sector: "Alimentos",
  city: "CABA",
  goalArs: 1000n,
  totalStroops: 2_500_000n,
  goalStroops: 10_000_000n,
  revenueShare: 5,
  riskBand: "medium",
  riskConfidence: 0.72,
  closeDate: "2026-12-01T00:00:00.000Z",
  hasImage: false,
  rateSnapshot: { version: 5, usdToArs: 1_000_000_000n, stroopsPerUsd: 10_000_000n }
};

const OBJECT_PATH = "123e4567-e89b-42d3-a456-426614174000/photo/abc-panaderia.jpg";
const IMAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

function marketplace(
  options: {
    listed?: Awaited<ReturnType<MarketplaceCampaignRepositoryPort["listPublished"]>>;
    image?: Awaited<ReturnType<MarketplaceCampaignRepositoryPort["findPublishedImage"]>>;
    download?: Awaited<ReturnType<StoragePort["downloadObject"]>>;
  } = {}
): MarketplaceRouteDependencies {
  return {
    campaigns: {
      listPublished: async () => options.listed ?? { ok: true as const, value: [] },
      findPublishedImage: async () => options.image ?? { ok: true as const, value: undefined }
    },
    storage: {
      downloadObject: async () =>
        options.download ?? { ok: true as const, value: { bytes: IMAGE_BYTES, contentType: "image/jpeg" } }
    }
  };
}

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /marketplace/campaigns", () => {
  it("is reachable without a token and answers the contract envelope with a cache header", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      marketplace: marketplace({ listed: { ok: true, value: [RECORD] } })
    });

    const response = await app.inject({ method: "GET", url: "/marketplace/campaigns" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.headers["cache-control"]).toContain("max-age=");

    const body = parseMarketplaceCampaignList(response.json());
    expect(body.items).toEqual([
      {
        campaignId: RECORD.campaignId,
        name: "Panadería Sol",
        sector: "Alimentos",
        city: "CABA",
        goalArs: 1000,
        raisedArs: 250,
        fundedPercentBps: 2500,
        revenueShare: 5,
        riskBand: "medium",
        riskConfidence: 0.72,
        closeDate: "2026-12-01T00:00:00.000Z",
        imageUrl: null
      }
    ]);
  });

  it("points imageUrl at the campaign image endpoint when the card has an image (#414/WU3)", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      marketplace: marketplace({ listed: { ok: true, value: [{ ...RECORD, hasImage: true }] } })
    });

    const response = await app.inject({ method: "GET", url: "/marketplace/campaigns" });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ items: Array<{ imageUrl: string | null }> }>().items[0]?.imageUrl).toBe(
      `/marketplace/campaigns/${RECORD.campaignId}/image`
    );
  });

  it("answers an empty published list with 200 and no items", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      marketplace: marketplace({ listed: { ok: true, value: [] } })
    });

    const response = await app.inject({ method: "GET", url: "/marketplace/campaigns" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [] });
  });

  it("answers a sanitized 503 when the repository is unavailable", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      marketplace: marketplace({ listed: { ok: false, error: { code: "unavailable" } } })
    });

    const response = await app.inject({ method: "GET", url: "/marketplace/campaigns" });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
  });
});

describe("GET /marketplace/campaigns/:campaignId/image", () => {
  const url = `/marketplace/campaigns/${RECORD.campaignId}/image`;

  it("streams the image bytes with the real content type and cache/security headers, without a token", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      marketplace: marketplace({
        image: { ok: true, value: { objectPath: OBJECT_PATH, contentType: "image/jpeg" } }
      })
    });

    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^image\/jpeg/);
    expect(response.headers["content-disposition"]).toBe("inline");
    expect(response.headers["cache-control"]).toBe("public, max-age=300");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.from(response.rawPayload).equals(Buffer.from(IMAGE_BYTES))).toBe(true);
    // The private object path and any storage URL never cross the wire.
    expect(response.body).not.toContain(OBJECT_PATH);
    expect(JSON.stringify(response.headers)).not.toContain(OBJECT_PATH);
  });

  it("answers 404 when the campaign is not published or has no image", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      marketplace: marketplace({ image: { ok: true, value: undefined } })
    });

    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("answers 404 for a malformed campaign id before touching the repository", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      marketplace: marketplace({
        image: { ok: true, value: { objectPath: OBJECT_PATH, contentType: "image/jpeg" } }
      })
    });

    const response = await app.inject({ method: "GET", url: "/marketplace/campaigns/not-a-uuid/image" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("answers a sanitized 503 when the repository is unavailable", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      marketplace: marketplace({ image: { ok: false, error: { code: "unavailable" } } })
    });

    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
  });

  it("answers a sanitized 503 when the storage read fails", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      marketplace: marketplace({
        image: { ok: true, value: { objectPath: OBJECT_PATH, contentType: "image/jpeg" } },
        download: { ok: false, error: { code: "unavailable" } }
      })
    });

    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
  });
});

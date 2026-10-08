import { parseMarketplaceCampaignList } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type {
  MarketplaceCampaignRecord,
  MarketplaceCampaignRepositoryPort
} from "../../../application/ports/marketplace-campaign-repository-port.js";
import { buildApp } from "../build-app.js";
import { fakeAuthPort } from "../test-support/auth.js";

/**
 * `GET /marketplace/campaigns` is the only public listing today: it serves the
 * published-campaign cards the investor marketplace renders. It needs no
 * token, answers the contract envelope, and a repository failure is a
 * sanitized 503, never an empty-but-successful list.
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
  rateSnapshot: { version: 5, usdToArs: 1_000_000_000n, stroopsPerUsd: 10_000_000n }
};

function repository(
  value: Awaited<ReturnType<MarketplaceCampaignRepositoryPort["listPublished"]>>
): { campaigns: Pick<MarketplaceCampaignRepositoryPort, "listPublished"> } {
  return { campaigns: { listPublished: async () => value } };
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
      marketplace: repository({ ok: true, value: [RECORD] })
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

  it("answers an empty published list with 200 and no items", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      marketplace: repository({ ok: true, value: [] })
    });

    const response = await app.inject({ method: "GET", url: "/marketplace/campaigns" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [] });
  });

  it("answers a sanitized 503 when the repository is unavailable", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      marketplace: repository({ ok: false, error: { code: "unavailable" } })
    });

    const response = await app.inject({ method: "GET", url: "/marketplace/campaigns" });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
  });
});

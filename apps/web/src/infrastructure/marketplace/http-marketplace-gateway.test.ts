import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { HttpMarketplaceGateway } from "./http-marketplace-gateway";

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const IMAGE_URL = `/marketplace/campaigns/${CAMPAIGN_ID}/image`;
const BASE = "http://localhost:3000";

const WIRE_ITEM = {
  campaignId: CAMPAIGN_ID,
  name: "Panadería Horizonte SRL",
  sector: "Alimentos",
  city: "Rosario",
  goalArs: 9_450_000,
  raisedArs: 5_954_000,
  fundedPercentBps: 6_300,
  revenueShare: 4.5,
  riskBand: "low",
  riskConfidence: 0.8,
  closeDate: "2026-11-30T12:00:00.000Z",
  imageUrl: IMAGE_URL
};

function fakeClient(result: { status: number; data: unknown } | Error) {
  const calls: { url: string }[] = [];
  const client = {
    get: async (url: string) => {
      calls.push({ url });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

describe("HttpMarketplaceGateway.list", () => {
  it("reads the list and resolves the API-relative image against the base URL", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { items: [WIRE_ITEM] } });
    const gateway = new HttpMarketplaceGateway(client, BASE);

    const result = await gateway.list();

    expect(calls[0]!.url).toBe("/marketplace/campaigns");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      campaignId: CAMPAIGN_ID,
      name: "Panadería Horizonte SRL",
      sector: "Alimentos",
      city: "Rosario",
      goalArs: 9_450_000,
      raisedArs: 5_954_000,
      fundedPercentBps: 6_300,
      revenueShare: 4.5,
      riskBand: "low",
      riskConfidence: 0.8,
      closeDate: "2026-11-30T12:00:00.000Z"
    });
    expect(result.items[0]!.imageSrc).toBe(`${BASE}${IMAGE_URL}`);
  });

  it("keeps a null image as null", async () => {
    const { client } = fakeClient({ status: 200, data: { items: [{ ...WIRE_ITEM, imageUrl: null }] } });
    const gateway = new HttpMarketplaceGateway(client, BASE);

    const result = await gateway.list();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items[0]!.imageSrc).toBeNull();
  });

  it("fails an unresolvable image against a malformed base as unavailable", async () => {
    const { client } = fakeClient({ status: 200, data: { items: [WIRE_ITEM] } });
    const gateway = new HttpMarketplaceGateway(client, "not a url");

    expect(await gateway.list()).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a non-200 status to unavailable", async () => {
    const { client } = fakeClient({ status: 503, data: { code: "unavailable" } });
    const gateway = new HttpMarketplaceGateway(client, BASE);

    expect(await gateway.list()).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    const gateway = new HttpMarketplaceGateway(client, BASE);

    expect(await gateway.list()).toEqual({ ok: false, code: "network" });
  });

  it("rejects a malformed body instead of rendering it", async () => {
    const { client } = fakeClient({ status: 200, data: { items: [{ ...WIRE_ITEM, fundedPercentBps: 20_000 }] } });
    const gateway = new HttpMarketplaceGateway(client, BASE);

    expect(await gateway.list()).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("HttpMarketplaceGateway.create", () => {
  it("builds a gateway whose list is callable", () => {
    const gateway = HttpMarketplaceGateway.create(BASE);
    expect(typeof gateway.list).toBe("function");
  });
});

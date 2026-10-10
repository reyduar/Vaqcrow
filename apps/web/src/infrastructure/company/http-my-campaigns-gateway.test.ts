import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpMyCampaignsGateway } from "./http-my-campaigns-gateway";

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const DIST_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_URL = `/marketplace/campaigns/${CAMPAIGN_ID}/image`;
const BASE = "http://localhost:3000";
const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";

const WIRE = {
  campaigns: [
    {
      campaignId: CAMPAIGN_ID,
      name: "Campaña 2026 · Panadería Horizonte",
      sector: "Alimentos",
      city: "Córdoba",
      imageUrl: IMAGE_URL,
      vaultAddress: VAULT,
      vaultExplorerUrl: null,
      state: "funding",
      goalArs: 15_000_000,
      raisedArs: 9_450_000,
      fundedPercentBps: 6_300,
      deadline: "2026-11-30T12:00:00.000Z",
      contributorsCount: 38,
      distributions: [
        {
          distributionId: DIST_ID,
          period: "2026-08",
          amountArs: 168_561,
          amountXlm: "1.2500000",
          state: "submitted",
          transactionHash: "a".repeat(64),
          explorerUrl: null
        }
      ],
      sales: [
        { period: "2026-08", salesArs: 3_745_800, status: "reported" },
        { period: "2026-07", salesArs: null, status: "missing" }
      ]
    }
  ]
};

type Result = { status: number; data: unknown } | Error;

function fakeClient(result: Result) {
  const calls: { url: string; headers: Record<string, string> | undefined }[] = [];
  const client = {
    get: async (url: string, config?: { headers?: Record<string, string> }) => {
      calls.push({ url, headers: config?.headers });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

const token: AccessTokenProvider = async () => "header.payload.signature";

describe("HttpMyCampaignsGateway.get", () => {
  it("reads every campaign with the bearer header and resolves the API-relative image", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE });
    const gateway = new HttpMyCampaignsGateway(client, BASE, token);

    const result = await gateway.get();

    expect(calls[0]!.url).toBe("/my-campaigns");
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer header.payload.signature" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const campaign = result.myCampaigns.campaigns[0]!;
    expect(campaign).toMatchObject({
      campaignId: CAMPAIGN_ID,
      name: "Campaña 2026 · Panadería Horizonte",
      sector: "Alimentos",
      city: "Córdoba",
      state: "funding",
      goalArs: 15_000_000,
      raisedArs: 9_450_000,
      fundedPercentBps: 6_300,
      contributorsCount: 38,
      vaultAddress: VAULT
    });
    expect(campaign.imageSrc).toBe(`${BASE}${IMAGE_URL}`);
    expect(campaign.distributions[0]).toEqual({
      distributionId: DIST_ID,
      period: "2026-08",
      amountArs: 168_561,
      amountXlm: "1.2500000",
      state: "submitted",
      transactionHash: "a".repeat(64),
      explorerUrl: null
    });
    expect(campaign.sales).toEqual([
      { period: "2026-08", salesArs: 3_745_800, status: "reported" },
      { period: "2026-07", salesArs: null, status: "missing" }
    ]);
  });

  it("keeps a null image as null", async () => {
    const { client } = fakeClient({
      status: 200,
      data: { campaigns: [{ ...WIRE.campaigns[0], imageUrl: null }] }
    });
    const gateway = new HttpMyCampaignsGateway(client, BASE, token);

    const result = await gateway.get();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.myCampaigns.campaigns[0]!.imageSrc).toBeNull();
  });

  it("treats an unresolvable image against a malformed base as null, not unavailable", async () => {
    const { client } = fakeClient({ status: 200, data: WIRE });
    const gateway = new HttpMyCampaignsGateway(client, "not a url", token);

    const result = await gateway.get();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.myCampaigns.campaigns[0]!.imageSrc).toBeNull();
  });

  it("returns an empty campaign list rather than an invented one", async () => {
    const { client } = fakeClient({ status: 200, data: { campaigns: [] } });
    const gateway = new HttpMyCampaignsGateway(client, BASE, token);

    const result = await gateway.get();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.myCampaigns.campaigns).toEqual([]);
  });

  it("maps 401 to unauthenticated", async () => {
    const { client } = fakeClient({ status: 401, data: { code: "unauthenticated" } });
    const gateway = new HttpMyCampaignsGateway(client, BASE, token);

    expect(await gateway.get()).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("maps 403 to unauthenticated", async () => {
    const { client } = fakeClient({ status: 403, data: { code: "forbidden" } });
    const gateway = new HttpMyCampaignsGateway(client, BASE, token);

    expect(await gateway.get()).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("maps a 503 unavailable envelope to unavailable", async () => {
    const { client } = fakeClient({ status: 503, data: { code: "unavailable" } });
    const gateway = new HttpMyCampaignsGateway(client, BASE, token);

    expect(await gateway.get()).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    const gateway = new HttpMyCampaignsGateway(client, BASE, token);

    expect(await gateway.get()).toEqual({ ok: false, code: "network" });
  });

  it("rejects a malformed body instead of rendering it", async () => {
    const { client } = fakeClient({
      status: 200,
      data: { campaigns: [{ ...WIRE.campaigns[0], fundedPercentBps: 20_000 }] }
    });
    const gateway = new HttpMyCampaignsGateway(client, BASE, token);

    expect(await gateway.get()).toEqual({ ok: false, code: "unavailable" });
  });

  it("never sends a bearer header for a token that is not a b64token", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { campaigns: [] } });
    const gateway = new HttpMyCampaignsGateway(client, BASE, async () => "not a token");

    await gateway.get();

    expect(calls[0]!.headers).toBeUndefined();
  });
});

describe("HttpMyCampaignsGateway.create", () => {
  it("builds a gateway whose get is callable", () => {
    const gateway = HttpMyCampaignsGateway.create(BASE);
    expect(typeof gateway.get).toBe("function");
  });
});

import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpPortfolioGateway } from "./http-portfolio-gateway";

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const DIST_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_URL = `/marketplace/campaigns/${CAMPAIGN_ID}/image`;
const BASE = "http://localhost:3000";
const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";

const WIRE = {
  contributions: [
    {
      campaignId: CAMPAIGN_ID,
      name: "Panadería Horizonte SRL",
      sector: "Alimentos",
      city: "Córdoba",
      imageUrl: IMAGE_URL,
      contributionXlm: "250.0000000",
      raisedArs: 9_450_000,
      goalArs: 15_000_000,
      fundedPercentBps: 6_300,
      status: "funding",
      closeDate: "2026-11-30T12:00:00.000Z",
      vaultAddress: VAULT
    }
  ],
  distributions: [
    {
      distributionId: DIST_ID,
      campaignId: CAMPAIGN_ID,
      campaignName: "Panadería Horizonte SRL",
      period: "2026-08",
      amountXlm: "4.1200000",
      status: "confirmed"
    }
  ],
  totals: {
    totalContributedXlm: "250.0000000",
    totalDistributionsXlm: "4.1200000",
    campaignCount: 1
  }
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

describe("HttpPortfolioGateway.get", () => {
  it("reads the summary with the bearer header and resolves the API-relative image", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE });
    const gateway = new HttpPortfolioGateway(client, BASE, token);

    const result = await gateway.get();

    expect(calls[0]!.url).toBe("/portfolio");
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer header.payload.signature" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.contributions[0]).toMatchObject({
      campaignId: CAMPAIGN_ID,
      name: "Panadería Horizonte SRL",
      sector: "Alimentos",
      city: "Córdoba",
      contributionXlm: "250.0000000",
      status: "funding",
      vaultAddress: VAULT
    });
    expect(result.summary.contributions[0]!.imageSrc).toBe(`${BASE}${IMAGE_URL}`);
    expect(result.summary.distributions[0]!.distributionId).toBe(DIST_ID);
    expect(result.summary.totals).toEqual({
      totalContributedXlm: "250.0000000",
      totalDistributionsXlm: "4.1200000",
      campaignCount: 1
    });
  });

  it("keeps a null image as null", async () => {
    const { client } = fakeClient({
      status: 200,
      data: { ...WIRE, contributions: [{ ...WIRE.contributions[0], imageUrl: null }] }
    });
    const gateway = new HttpPortfolioGateway(client, BASE, token);

    const result = await gateway.get();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.contributions[0]!.imageSrc).toBeNull();
  });

  it("treats an unresolvable image against a malformed base as null, not unavailable", async () => {
    const { client } = fakeClient({ status: 200, data: WIRE });
    const gateway = new HttpPortfolioGateway(client, "not a url", token);

    const result = await gateway.get();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.contributions[0]!.imageSrc).toBeNull();
  });

  it("maps 401 to unauthenticated", async () => {
    const { client } = fakeClient({ status: 401, data: { code: "unauthenticated" } });
    const gateway = new HttpPortfolioGateway(client, BASE, token);

    expect(await gateway.get()).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("maps 403 to unauthenticated", async () => {
    const { client } = fakeClient({ status: 403, data: { code: "forbidden" } });
    const gateway = new HttpPortfolioGateway(client, BASE, token);

    expect(await gateway.get()).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("maps a 503 unavailable envelope to unavailable", async () => {
    const { client } = fakeClient({ status: 503, data: { code: "unavailable" } });
    const gateway = new HttpPortfolioGateway(client, BASE, token);

    expect(await gateway.get()).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    const gateway = new HttpPortfolioGateway(client, BASE, token);

    expect(await gateway.get()).toEqual({ ok: false, code: "network" });
  });

  it("rejects a malformed body instead of rendering it", async () => {
    const { client } = fakeClient({
      status: 200,
      data: { ...WIRE, contributions: [{ ...WIRE.contributions[0], fundedPercentBps: 20_000 }] }
    });
    const gateway = new HttpPortfolioGateway(client, BASE, token);

    expect(await gateway.get()).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("HttpPortfolioGateway.create", () => {
  it("builds a gateway whose get is callable", () => {
    const gateway = HttpPortfolioGateway.create(BASE);
    expect(typeof gateway.get).toBe("function");
  });
});

import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { HttpCampaignDetailGateway } from "./http-campaign-detail-gateway";

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const IMAGE_URL = `/marketplace/campaigns/${CAMPAIGN_ID}/image`;
const BASE = "http://localhost:3000";

const WIRE_DETAIL = {
  campaignId: CAMPAIGN_ID,
  name: "Panadería Horizonte SRL",
  sector: "Alimentos",
  city: "Rosario",
  description: "Panificados artesanales para comercios de cercanía.",
  foundedAt: "2021-05-01T00:00:00.000Z",
  goalArs: 9_450_000,
  raisedArs: 5_954_000,
  fundedPercentBps: 6_300,
  revenueShare: 4.5,
  riskBand: "low",
  riskConfidence: 0.8,
  closeDate: "2026-11-30T12:00:00.000Z",
  imageUrl: IMAGE_URL,
  status: "funding",
  backers: 12,
  vaultAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  assessment: {
    riskBand: "low",
    confidence: 0.72,
    reasons: ["Ventas estables", "Un mes con anomalía"],
    model: "evaluador-v1",
    generatedAt: "2026-09-12T10:42:00.000Z"
  },
  decision: {
    actor: "M. Pereyra",
    reason: "Documentación completa",
    approvedLimitArs: 9_450_000,
    recordedAt: "2026-09-13T09:15:00.000Z"
  },
  salesEvidence: {
    averageMonthlyArs: 3_700_000,
    declaredMonths: 2,
    totalMonths: 3,
    months: [
      { period: "2026-01", salesArs: 3_150_000, status: "reported", source: "Declaración mensual sintética" },
      { period: "2026-02", salesArs: null, status: "missing", source: "Declaración mensual sintética" },
      { period: "2026-03", salesArs: 4_250_000, status: "anomalous", source: "Declaración mensual sintética" }
    ]
  }
};

function fakeClient(result: { status: number; data: unknown } | Error) {
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

describe("HttpCampaignDetailGateway.get", () => {
  it("reads the detail and resolves the API-relative image against the base URL", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE_DETAIL });
    const gateway = new HttpCampaignDetailGateway(client, BASE);

    const result = await gateway.get(CAMPAIGN_ID);

    expect(calls[0]!.url).toBe(`/marketplace/campaigns/${CAMPAIGN_ID}`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail).toMatchObject({
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
      status: "funding",
      backers: 12,
      vaultAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"
    });
    expect(result.detail.imageSrc).toBe(`${BASE}${IMAGE_URL}`);
    expect(result.detail.assessment?.model).toBe("evaluador-v1");
    expect(result.detail.decision?.actor).toBe("M. Pereyra");
    expect(result.detail.salesEvidence).toEqual(WIRE_DETAIL.salesEvidence);
  });

  it("keeps a missing month's sales as null through the gateway", async () => {
    const { client } = fakeClient({ status: 200, data: { ...WIRE_DETAIL, imageUrl: null } });
    const gateway = new HttpCampaignDetailGateway(client, BASE);

    const result = await gateway.get(CAMPAIGN_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail.salesEvidence?.months[1]).toEqual({
      period: "2026-02",
      salesArs: null,
      status: "missing",
      source: "Declaración mensual sintética"
    });
  });

  it("keeps a null sales evidence as null", async () => {
    const { client } = fakeClient({ status: 200, data: { ...WIRE_DETAIL, salesEvidence: null } });
    const gateway = new HttpCampaignDetailGateway(client, BASE);

    const result = await gateway.get(CAMPAIGN_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail.salesEvidence).toBeNull();
  });

  it("attaches the Bearer token from the access-token provider", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { ...WIRE_DETAIL, imageUrl: null } });
    const gateway = new HttpCampaignDetailGateway(client, BASE, async () => "token-123");

    await gateway.get(CAMPAIGN_ID);

    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
  });

  it("keeps a null image as null", async () => {
    const { client } = fakeClient({ status: 200, data: { ...WIRE_DETAIL, imageUrl: null } });
    const gateway = new HttpCampaignDetailGateway(client, BASE);

    const result = await gateway.get(CAMPAIGN_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail.imageSrc).toBeNull();
  });

  it("fails an unresolvable image against a malformed base as unavailable", async () => {
    const { client } = fakeClient({ status: 200, data: WIRE_DETAIL });
    const gateway = new HttpCampaignDetailGateway(client, "not a url");

    expect(await gateway.get(CAMPAIGN_ID)).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps 401 to unauthenticated", async () => {
    const { client } = fakeClient({ status: 401, data: { code: "unauthenticated" } });
    const gateway = new HttpCampaignDetailGateway(client, BASE);

    expect(await gateway.get(CAMPAIGN_ID)).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("maps 403 to unauthenticated", async () => {
    const { client } = fakeClient({ status: 403, data: { code: "unauthenticated" } });
    const gateway = new HttpCampaignDetailGateway(client, BASE);

    expect(await gateway.get(CAMPAIGN_ID)).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("maps 404 to not_found", async () => {
    const { client } = fakeClient({ status: 404, data: { code: "not_found" } });
    const gateway = new HttpCampaignDetailGateway(client, BASE);

    expect(await gateway.get(CAMPAIGN_ID)).toEqual({ ok: false, code: "not_found" });
  });

  it("maps any other non-200 status to unavailable", async () => {
    const { client } = fakeClient({ status: 503, data: { code: "unavailable" } });
    const gateway = new HttpCampaignDetailGateway(client, BASE);

    expect(await gateway.get(CAMPAIGN_ID)).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    const gateway = new HttpCampaignDetailGateway(client, BASE);

    expect(await gateway.get(CAMPAIGN_ID)).toEqual({ ok: false, code: "network" });
  });

  it("rejects a malformed success body instead of rendering it", async () => {
    const { client } = fakeClient({ status: 200, data: { ...WIRE_DETAIL, fundedPercentBps: 20_000 } });
    const gateway = new HttpCampaignDetailGateway(client, BASE);

    expect(await gateway.get(CAMPAIGN_ID)).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("HttpCampaignDetailGateway.create", () => {
  it("builds a gateway whose get is callable", () => {
    const gateway = HttpCampaignDetailGateway.create(BASE);
    expect(typeof gateway.get).toBe("function");
  });
});

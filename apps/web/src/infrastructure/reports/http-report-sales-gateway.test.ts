import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpReportSalesGateway } from "./http-report-sales-gateway";

const BASE = "http://localhost:3000";
const IMAGE_URL = "/marketplace/campaigns/3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10/image";

const WIRE = {
  pymes: [
    {
      name: "Café Tostadero del Paraná",
      sector: "Gastronomía · Rosario",
      imageUrl: IMAGE_URL,
      period: "2026-08",
      salesArs: 3_902_100,
      status: "reported"
    },
    {
      name: "Panadería Horizonte SRL",
      sector: "Alimentos · Córdoba",
      imageUrl: null,
      period: "2026-08",
      salesArs: null,
      status: "missing"
    }
  ]
};

type Result = { status: number; data: unknown } | Error;

function fakeClient(result: Result) {
  const calls: { url: string; params: unknown; headers: Record<string, string> | undefined }[] = [];
  const client = {
    get: async (url: string, config?: { params?: unknown; headers?: Record<string, string> }) => {
      calls.push({ url, params: config?.params, headers: config?.headers });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

const token: AccessTokenProvider = async () => "header.payload.signature";

describe("HttpReportSalesGateway.get", () => {
  it("reads the sales block and resolves the API-relative image to an absolute URL", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE });
    const gateway = new HttpReportSalesGateway(client, BASE, token);

    const result = await gateway.get("2026-08", "2026-08");

    expect(calls[0]!.url).toBe("/reports/sales-by-pyme");
    expect(calls[0]!.params).toEqual({ from: "2026-08", to: "2026-08" });
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer header.payload.signature" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sales.pymes[0]!.imageSrc).toBe(`${BASE}${IMAGE_URL}`);
    expect(result.sales.pymes[0]!.salesArs).toBe(3_902_100);
  });

  it("keeps a null image and a null sale as null", async () => {
    const { client } = fakeClient({ status: 200, data: WIRE });
    const gateway = new HttpReportSalesGateway(client, BASE, token);

    const result = await gateway.get(null, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sales.pymes[1]!.imageSrc).toBeNull();
    expect(result.sales.pymes[1]!.salesArs).toBeNull();
  });

  it("treats an unresolvable image against a malformed base as null, not unavailable", async () => {
    const { client } = fakeClient({ status: 200, data: WIRE });
    const gateway = new HttpReportSalesGateway(client, "not a url", token);

    const result = await gateway.get(null, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sales.pymes[0]!.imageSrc).toBeNull();
  });

  it("maps 401 to unauthenticated and any other non-200 to unavailable", async () => {
    const unauthorized = new HttpReportSalesGateway(fakeClient({ status: 401, data: { code: "unauthenticated" } }).client, BASE, token);
    const unavailable = new HttpReportSalesGateway(fakeClient({ status: 400, data: { code: "invalid_request" } }).client, BASE, token);

    expect(await unauthorized.get(null, null)).toEqual({ ok: false, code: "unauthenticated" });
    expect(await unavailable.get(null, null)).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const gateway = new HttpReportSalesGateway(fakeClient(new Error("boom")).client, BASE, token);
    expect(await gateway.get(null, null)).toEqual({ ok: false, code: "network" });
  });

  it("rejects a malformed body instead of rendering it", async () => {
    const gateway = new HttpReportSalesGateway(
      fakeClient({ status: 200, data: { pymes: [{ ...WIRE.pymes[0], period: "2026-13" }] } }).client,
      BASE,
      token
    );
    expect(await gateway.get(null, null)).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("HttpReportSalesGateway.create", () => {
  it("builds a gateway whose get is callable", () => {
    const gateway = HttpReportSalesGateway.create(BASE);
    expect(typeof gateway.get).toBe("function");
  });
});

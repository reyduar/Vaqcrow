import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import type { SalesDeclarationPeriod } from "@/application/ports/sales-declaration-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpSalesDeclarationGateway } from "./http-sales-declaration-gateway";

const BASE = "http://localhost:3000";
const BUSINESS_ID = "b1e6c2a4-9f3d-4a7b-8c1e-5d2f6a9b0c31";

const PERIODS: readonly SalesDeclarationPeriod[] = [
  { period: "2026-01", salesArs: 1_850_000 },
  { period: "2026-02", salesArs: null }
];

type Result = { status: number; data?: unknown } | Error;

function fakeClient(result: Result) {
  const calls: {
    url: string;
    body: unknown;
    headers: Record<string, string> | undefined;
  }[] = [];
  const client = {
    post: async (
      url: string,
      body: unknown,
      config?: { headers?: Record<string, string> }
    ) => {
      calls.push({ url, body, headers: config?.headers });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

const token: AccessTokenProvider = async () => "header.payload.signature";

describe("HttpSalesDeclarationGateway.declare", () => {
  it("POSTs exactly the declared periods with the bearer header", async () => {
    const { client, calls } = fakeClient({ status: 200, data: {} });
    const gateway = new HttpSalesDeclarationGateway(client, token);

    const result = await gateway.declare(BUSINESS_ID, PERIODS);

    expect(calls[0]!.url).toBe(`/businesses/${BUSINESS_ID}/sales-periods`);
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer header.payload.signature" });
    expect(calls[0]!.body).toEqual({ periods: PERIODS });
    expect(result).toEqual({ ok: true });
  });

  it("never sends an owner, user id or any other identity key", async () => {
    const { client, calls } = fakeClient({ status: 200, data: {} });
    const gateway = new HttpSalesDeclarationGateway(client, token);

    await gateway.declare(BUSINESS_ID, PERIODS);

    expect(Object.keys(calls[0]!.body as object)).toEqual(["periods"]);
  });

  it("encodes the business id into the path", async () => {
    const { client, calls } = fakeClient({ status: 200, data: {} });
    const gateway = new HttpSalesDeclarationGateway(client, token);

    await gateway.declare("a b/c", PERIODS);

    expect(calls[0]!.url).toBe("/businesses/a%20b%2Fc/sales-periods");
  });

  it("maps 400 to invalid_request", async () => {
    const { client } = fakeClient({ status: 400, data: { code: "invalid_request" } });
    const gateway = new HttpSalesDeclarationGateway(client, token);

    expect(await gateway.declare(BUSINESS_ID, PERIODS)).toEqual({ ok: false, code: "invalid_request" });
  });

  it("maps 401 and 403 to unauthenticated", async () => {
    for (const status of [401, 403]) {
      const { client } = fakeClient({ status, data: {} });
      const gateway = new HttpSalesDeclarationGateway(client, token);
      expect(await gateway.declare(BUSINESS_ID, PERIODS)).toEqual({ ok: false, code: "unauthenticated" });
    }
  });

  it("maps 404 to not_found", async () => {
    const { client } = fakeClient({ status: 404, data: { code: "not_found" } });
    const gateway = new HttpSalesDeclarationGateway(client, token);

    expect(await gateway.declare(BUSINESS_ID, PERIODS)).toEqual({ ok: false, code: "not_found" });
  });

  it("maps 503 and any other non-200 to unavailable", async () => {
    for (const status of [503, 500]) {
      const { client } = fakeClient({ status, data: {} });
      const gateway = new HttpSalesDeclarationGateway(client, token);
      expect(await gateway.declare(BUSINESS_ID, PERIODS)).toEqual({ ok: false, code: "unavailable" });
    }
  });

  it("maps a transport failure to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    const gateway = new HttpSalesDeclarationGateway(client, token);

    expect(await gateway.declare(BUSINESS_ID, PERIODS)).toEqual({ ok: false, code: "network" });
  });

  it("never sends a bearer header for a token that is not a b64token", async () => {
    const { client, calls } = fakeClient({ status: 200, data: {} });
    const gateway = new HttpSalesDeclarationGateway(client, async () => "not a token");

    await gateway.declare(BUSINESS_ID, PERIODS);

    expect(calls[0]!.headers).toBeUndefined();
  });
});

describe("HttpSalesDeclarationGateway.create", () => {
  it("builds a gateway whose declare is callable", () => {
    const gateway = HttpSalesDeclarationGateway.create(BASE);
    expect(typeof gateway.declare).toBe("function");
  });
});

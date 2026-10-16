import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { HttpRateGateway } from "./http-rate-gateway";

interface Call {
  readonly url: string;
  readonly headers: Record<string, string> | undefined;
}

function fakeClient(result: { status: number; data: unknown } | Error) {
  const calls: Call[] = [];
  const client = {
    get: async (url: string, config?: { headers?: Record<string, string> }) => {
      calls.push({ url, headers: config?.headers });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

const BODY = { rate: { version: 3, effectiveAt: "2026-10-06T00:00:00.000Z", usdToArs: "1400000000", stroopsPerUsd: "30000000" } };

describe("HttpRateGateway (#572)", () => {
  it("reads GET /rates/current with the Bearer token and returns the rate as bigints", async () => {
    const { client, calls } = fakeClient({ status: 200, data: BODY });

    const result = await new HttpRateGateway(client, async () => "token-123").getCurrent();

    expect(result).toEqual({ ok: true, rate: { usdToArs: 1_400_000_000n, stroopsPerUsd: 30_000_000n } });
    expect(calls[0]?.url).toBe("/rates/current");
    expect(calls[0]?.headers).toEqual({ Authorization: "Bearer token-123" });
  });

  it("maps 404 to not_found, 401/403 to unauthenticated and any other status to unavailable", async () => {
    expect(await new HttpRateGateway(fakeClient({ status: 404, data: {} }).client).getCurrent()).toEqual({ ok: false, code: "not_found" });
    expect(await new HttpRateGateway(fakeClient({ status: 401, data: {} }).client).getCurrent()).toEqual({ ok: false, code: "unauthenticated" });
    expect(await new HttpRateGateway(fakeClient({ status: 403, data: {} }).client).getCurrent()).toEqual({ ok: false, code: "unauthenticated" });
    expect(await new HttpRateGateway(fakeClient({ status: 503, data: {} }).client).getCurrent()).toEqual({ ok: false, code: "unavailable" });
  });

  it("treats a malformed success body as unavailable, never a made-up rate", async () => {
    for (const data of [{}, { rate: { usdToArs: 1400, stroopsPerUsd: "3" } }, { rate: { usdToArs: "-1", stroopsPerUsd: "3" } }]) {
      expect(await new HttpRateGateway(fakeClient({ status: 200, data }).client).getCurrent()).toEqual({ ok: false, code: "unavailable" });
    }
  });

  it("reports a transport failure as network", async () => {
    expect(await new HttpRateGateway(fakeClient(new Error("offline")).client).getCurrent()).toEqual({ ok: false, code: "network" });
  });
});

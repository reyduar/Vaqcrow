import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { HttpInvestorKycGateway } from "./http-investor-kyc-gateway";

const APPROVED_AT = "2026-10-08T18:30:00.000Z";

interface Call {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string> | undefined;
}

function fakeClient(result: { status: number; data: unknown } | Error) {
  const calls: Call[] = [];
  const respond = async (method: string, url: string, config?: { headers?: Record<string, string> }) => {
    calls.push({ method, url, headers: config?.headers });
    if (result instanceof Error) throw result;
    return result;
  };
  const client = {
    get: (url: string, config?: { headers?: Record<string, string> }) => respond("get", url, config),
    post: (url: string, _data: unknown, config?: { headers?: Record<string, string> }) =>
      respond("post", url, config)
  } as unknown as AxiosInstance;
  return { client, calls };
}

const APPROVED = { approved: true, approvedAt: APPROVED_AT, simulado: true };
const ABSENT = { approved: false, approvedAt: null, simulado: true };

describe("HttpInvestorKycGateway.get", () => {
  it("reads the status with the Bearer token", async () => {
    const { client, calls } = fakeClient({ status: 200, data: ABSENT });
    const gateway = new HttpInvestorKycGateway(client, async () => "token-123");

    const result = await gateway.get();

    expect(result).toEqual({ ok: true, status: ABSENT });
    expect(calls[0]!.method).toBe("get");
    expect(calls[0]!.url).toBe("/investor-kyc");
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
  });

  it("sends no Authorization header without a provider", async () => {
    const { client, calls } = fakeClient({ status: 200, data: ABSENT });
    const gateway = new HttpInvestorKycGateway(client);

    await gateway.get();

    expect(calls[0]!.headers).toBeUndefined();
  });

  it("maps 401 and 403 to unauthenticated", async () => {
    const unauthorized = fakeClient({ status: 401, data: { code: "unauthenticated" } });
    const forbidden = fakeClient({ status: 403, data: { code: "forbidden" } });

    expect(await new HttpInvestorKycGateway(unauthorized.client).get()).toEqual({
      ok: false,
      code: "unauthenticated"
    });
    expect(await new HttpInvestorKycGateway(forbidden.client).get()).toEqual({
      ok: false,
      code: "unauthenticated"
    });
  });

  it("maps any other non-200 status to unavailable", async () => {
    const { client } = fakeClient({ status: 503, data: { code: "unavailable" } });
    expect(await new HttpInvestorKycGateway(client).get()).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    expect(await new HttpInvestorKycGateway(client).get()).toEqual({ ok: false, code: "network" });
  });

  it("rejects a malformed body instead of rendering it", async () => {
    const { client } = fakeClient({ status: 200, data: { approved: "yes", approvedAt: null, simulado: true } });
    expect(await new HttpInvestorKycGateway(client).get()).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("HttpInvestorKycGateway.approve", () => {
  it("posts and accepts both 201 (created) and 200 (replay)", async () => {
    const created = fakeClient({ status: 201, data: APPROVED });
    const replay = fakeClient({ status: 200, data: APPROVED });

    expect(await new HttpInvestorKycGateway(created.client).approve()).toEqual({ ok: true, status: APPROVED });
    expect(await new HttpInvestorKycGateway(replay.client).approve()).toEqual({ ok: true, status: APPROVED });
    expect(created.calls[0]!.method).toBe("post");
    expect(created.calls[0]!.url).toBe("/investor-kyc");
  });

  it("maps an unauthenticated approve to unauthenticated", async () => {
    const { client } = fakeClient({ status: 401, data: { code: "unauthenticated" } });
    expect(await new HttpInvestorKycGateway(client).approve()).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("maps a transport failure on approve to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    expect(await new HttpInvestorKycGateway(client).approve()).toEqual({ ok: false, code: "network" });
  });
});

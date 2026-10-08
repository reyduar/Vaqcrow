import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { HttpFavoriteGateway } from "./http-favorite-gateway";

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

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
    put: (url: string, _data: unknown, config?: { headers?: Record<string, string> }) => respond("put", url, config),
    delete: (url: string, config?: { headers?: Record<string, string> }) => respond("delete", url, config)
  } as unknown as AxiosInstance;
  return { client, calls };
}

describe("HttpFavoriteGateway.list", () => {
  it("reads the favorites with the Bearer token", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { campaignIds: [CAMPAIGN_ID] } });
    const gateway = new HttpFavoriteGateway(client, async () => "token-123");

    const result = await gateway.list();

    expect(result).toEqual({ ok: true, campaignIds: [CAMPAIGN_ID] });
    expect(calls[0]!.method).toBe("get");
    expect(calls[0]!.url).toBe("/favorites");
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
  });

  it("sends no Authorization header without a provider", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { campaignIds: [] } });
    const gateway = new HttpFavoriteGateway(client);

    await gateway.list();

    expect(calls[0]!.headers).toBeUndefined();
  });

  it("sends no Authorization header when the provider throws", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { campaignIds: [] } });
    const gateway = new HttpFavoriteGateway(client, async () => {
      throw new Error("no session");
    });

    await gateway.list();

    expect(calls[0]!.headers).toBeUndefined();
  });

  it("maps 401 and 403 to unauthenticated", async () => {
    const unauthorized = fakeClient({ status: 401, data: { code: "unauthorized" } });
    const forbidden = fakeClient({ status: 403, data: { code: "forbidden" } });

    expect(await new HttpFavoriteGateway(unauthorized.client).list()).toEqual({ ok: false, code: "unauthenticated" });
    expect(await new HttpFavoriteGateway(forbidden.client).list()).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("maps any other non-200 status to unavailable", async () => {
    const { client } = fakeClient({ status: 503, data: { code: "unavailable" } });
    expect(await new HttpFavoriteGateway(client).list()).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    expect(await new HttpFavoriteGateway(client).list()).toEqual({ ok: false, code: "network" });
  });

  it("rejects a malformed body instead of rendering it", async () => {
    const { client } = fakeClient({ status: 200, data: { campaignIds: ["not-a-uuid"] } });
    expect(await new HttpFavoriteGateway(client).list()).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("HttpFavoriteGateway add/remove", () => {
  it("adds with PUT and returns the applied flag", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { campaignId: CAMPAIGN_ID, applied: true } });
    const gateway = new HttpFavoriteGateway(client, async () => "token-123");

    const result = await gateway.add(CAMPAIGN_ID);

    expect(result).toEqual({ ok: true, applied: true });
    expect(calls[0]!.method).toBe("put");
    expect(calls[0]!.url).toBe(`/favorites/${CAMPAIGN_ID}`);
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
  });

  it("removes with DELETE and returns the applied flag", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { campaignId: CAMPAIGN_ID, applied: false } });
    const gateway = new HttpFavoriteGateway(client);

    const result = await gateway.remove(CAMPAIGN_ID);

    expect(result).toEqual({ ok: true, applied: false });
    expect(calls[0]!.method).toBe("delete");
    expect(calls[0]!.url).toBe(`/favorites/${CAMPAIGN_ID}`);
  });

  it("maps an unauthenticated add to unauthenticated", async () => {
    const { client } = fakeClient({ status: 401, data: { code: "unauthorized" } });
    expect(await new HttpFavoriteGateway(client).add(CAMPAIGN_ID)).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("maps a transport failure on remove to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    expect(await new HttpFavoriteGateway(client).remove(CAMPAIGN_ID)).toEqual({ ok: false, code: "network" });
  });

  it("rejects a malformed toggle body", async () => {
    const { client } = fakeClient({ status: 200, data: { campaignId: CAMPAIGN_ID, applied: "yes" } });
    expect(await new HttpFavoriteGateway(client).add(CAMPAIGN_ID)).toEqual({ ok: false, code: "unavailable" });
  });
});

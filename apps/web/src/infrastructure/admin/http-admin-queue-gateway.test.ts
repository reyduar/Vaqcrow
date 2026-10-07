import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import type { AdminQueueQuery } from "@/application/ports/admin-queue-port";
import { HttpAdminQueueGateway } from "./http-admin-queue-gateway";

const QUERY: AdminQueueQuery = { page: 2, pageSize: 20, sort: "updatedAt", order: "desc", search: "Panadería" };

const WIRE_PAGE = {
  items: [
    {
      applicationId: "VQ-0001",
      name: "Panadería Horizonte SRL",
      sector: "Alimentos",
      state: "awaiting_assessment",
      updatedAt: "2026-09-11T12:00:00.000Z"
    }
  ],
  page: 2,
  pageSize: 20,
  total: 41
};

interface Call {
  readonly url: string;
  readonly params: Record<string, unknown> | undefined;
  readonly headers: Record<string, string> | undefined;
}

function fakeClient(result: { status: number; data: unknown } | Error) {
  const calls: Call[] = [];
  const client = {
    get: async (url: string, config: { params?: Record<string, unknown>; headers?: Record<string, string> }) => {
      calls.push({ url, params: config.params, headers: config.headers });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

describe("HttpAdminQueueGateway.list", () => {
  it("reads the queue page with the Bearer token and the resolved query", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE_PAGE });
    const gateway = new HttpAdminQueueGateway(client, async () => "token-123");

    const result = await gateway.list(QUERY);

    expect(result).toEqual({ ok: true, page: WIRE_PAGE });
    expect(calls[0]!.url).toBe("/sme-requests");
    expect(calls[0]!.params).toEqual({ page: 2, pageSize: 20, sort: "updatedAt", order: "desc", q: "Panadería" });
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
  });

  it("omits q when there is no search term", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { ...WIRE_PAGE, items: [] } });
    const gateway = new HttpAdminQueueGateway(client);

    await gateway.list({ page: 1, pageSize: 20, sort: "name", order: "asc" });

    expect(calls[0]!.params).toEqual({ page: 1, pageSize: 20, sort: "name", order: "asc" });
    expect(calls[0]!.headers).toBeUndefined();
  });

  it("maps a sanitized provider failure to unavailable", async () => {
    const { client } = fakeClient({ status: 503, data: { code: "unavailable" } });
    const gateway = new HttpAdminQueueGateway(client);

    expect(await gateway.list(QUERY)).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps an unauthorized status to unavailable rather than leaking it", async () => {
    const { client } = fakeClient({ status: 403, data: { code: "forbidden" } });
    const gateway = new HttpAdminQueueGateway(client);

    expect(await gateway.list(QUERY)).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    const gateway = new HttpAdminQueueGateway(client);

    expect(await gateway.list(QUERY)).toEqual({ ok: false, code: "network" });
  });

  it("rejects a malformed page instead of rendering it", async () => {
    const { client } = fakeClient({ status: 200, data: { ...WIRE_PAGE, total: "many" } });
    const gateway = new HttpAdminQueueGateway(client);

    expect(await gateway.list(QUERY)).toEqual({ ok: false, code: "unavailable" });
  });

  it("rejects an unknown review state instead of inventing a label", async () => {
    const { client } = fakeClient({
      status: 200,
      data: { ...WIRE_PAGE, items: [{ ...WIRE_PAGE.items[0], state: "banana" }] }
    });
    const gateway = new HttpAdminQueueGateway(client);

    expect(await gateway.list(QUERY)).toEqual({ ok: false, code: "unavailable" });
  });
});

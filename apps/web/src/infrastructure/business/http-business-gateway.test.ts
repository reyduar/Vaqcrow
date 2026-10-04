import type { AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BusinessDraft } from "@/application/ports/business-port";
import { HttpBusinessGateway } from "./http-business-gateway";

const DRAFT: BusinessDraft = {
  name: "Panadería Horizonte SRL",
  cuit: "30712345678",
  sector: "Alimentos",
  city: "Córdoba",
  description: "Pan de masa madre y facturas para barrio y 22 cafeterías.",
  goalArs: 15000000,
  revenueShare: 4.5
};

const WIRE_BUSINESS = {
  businessId: "b1e6c2a4-9f3d-4a7b-8c1e-5d2f6a9b0c31",
  ownerUserId: "00000000-0000-4000-8000-000000000000",
  ...DRAFT,
  createdAt: "2026-10-03T12:00:00.000Z",
  updatedAt: "2026-10-03T12:00:00.000Z"
};

interface Call {
  readonly method: "post" | "get";
  readonly url: string;
  readonly data: unknown;
  readonly config: Record<string, unknown> | undefined;
}

interface Fake {
  readonly post?: { status: number; data: unknown } | Error;
  readonly get?: { status: number; data: unknown } | Error;
}

function fakeClient(fake: Fake) {
  const calls: Call[] = [];
  const client = {
    post: async (url: string, data: unknown, config: Record<string, unknown> | undefined) => {
      calls.push({ method: "post", url, data, config });
      if (fake.post instanceof Error) throw fake.post;
      return fake.post ?? { status: 201, data: { business: WIRE_BUSINESS } };
    },
    get: async (url: string, config: Record<string, unknown> | undefined) => {
      calls.push({ method: "get", url, data: undefined, config });
      if (fake.get instanceof Error) throw fake.get;
      return fake.get ?? { status: 200, data: { business: WIRE_BUSINESS } };
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

afterEach(() => vi.restoreAllMocks());

describe("HttpBusinessGateway.createBusiness", () => {
  it("posts the JSON draft with the Bearer token and returns the stored company", async () => {
    const { client, calls } = fakeClient({});
    const gateway = new HttpBusinessGateway(client, async () => "token-123");

    const result = await gateway.createBusiness(DRAFT);

    expect(result).toEqual({ ok: true, business: WIRE_BUSINESS });
    const call = calls[0]!;
    expect(call.method).toBe("post");
    expect(call.url).toBe("/businesses");
    expect(call.data).toEqual(DRAFT);
    expect(call.config?.["headers"]).toEqual({ Authorization: "Bearer token-123" });
  });

  it("never puts an owner in the body", async () => {
    const { client, calls } = fakeClient({});
    const gateway = new HttpBusinessGateway(client, async () => "token");

    await gateway.createBusiness(DRAFT);

    const body = calls[0]!.data as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["name", "cuit", "sector", "city", "description", "goalArs", "revenueShare"]);
    expect(body["ownerUserId"]).toBeUndefined();
    expect(body["owner_user_id"]).toBeUndefined();
  });

  it("sends no Authorization header when there is no token", async () => {
    const { client, calls } = fakeClient({});
    const gateway = new HttpBusinessGateway(client, async () => null);

    await gateway.createBusiness(DRAFT);

    expect(calls[0]!.config?.["headers"]).toEqual({});
  });

  it("maps the API's 400 errors envelope to invalid_request", async () => {
    const { client } = fakeClient({ post: { status: 400, data: { errors: [{ field: "cuit", code: "invalid_format" }] } } });
    const gateway = new HttpBusinessGateway(client);

    expect(await gateway.createBusiness(DRAFT)).toEqual({ ok: false, code: "invalid_request" });
  });

  it("prefers the sanitized code of a 503 envelope", async () => {
    const { client } = fakeClient({ post: { status: 503, data: { code: "unavailable" } } });

    expect(await new HttpBusinessGateway(client).createBusiness(DRAFT)).toEqual({ ok: false, code: "unavailable" });
  });

  it("answers unavailable for a malformed success body", async () => {
    const { client } = fakeClient({ post: { status: 201, data: { business: { businessId: "x" } } } });

    expect(await new HttpBusinessGateway(client).createBusiness(DRAFT)).toEqual({ ok: false, code: "unavailable" });
  });

  it("answers network when the transport throws", async () => {
    const { client } = fakeClient({ post: new Error("socket hang up") });

    expect(await new HttpBusinessGateway(client).createBusiness(DRAFT)).toEqual({ ok: false, code: "network" });
  });
});

describe("HttpBusinessGateway.getMyBusiness", () => {
  it("reads the owner's company with the Bearer token", async () => {
    const { client, calls } = fakeClient({});
    const gateway = new HttpBusinessGateway(client, async () => "token-123");

    expect(await gateway.getMyBusiness()).toEqual({ ok: true, business: WIRE_BUSINESS });
    expect(calls[0]!.method).toBe("get");
    expect(calls[0]!.url).toBe("/businesses/mine");
    expect(calls[0]!.config?.["headers"]).toEqual({ Authorization: "Bearer token-123" });
  });

  it("maps 404 to not_found", async () => {
    const { client } = fakeClient({ get: { status: 404, data: { code: "not_found" } } });

    expect(await new HttpBusinessGateway(client).getMyBusiness()).toEqual({ ok: false, code: "not_found" });
  });

  it("sends no Authorization header when there is no token", async () => {
    const { client, calls } = fakeClient({});
    const gateway = new HttpBusinessGateway(client, async () => null);

    await gateway.getMyBusiness();

    expect(calls[0]!.config?.["headers"]).toEqual({});
  });

  it("maps an unexpected status to unavailable", async () => {
    const { client } = fakeClient({ get: { status: 503, data: { code: "unavailable" } } });

    expect(await new HttpBusinessGateway(client).getMyBusiness()).toEqual({ ok: false, code: "unavailable" });
  });

  it("answers unavailable for a malformed success body", async () => {
    const { client } = fakeClient({ get: { status: 200, data: { business: null } } });

    expect(await new HttpBusinessGateway(client).getMyBusiness()).toEqual({ ok: false, code: "unavailable" });
  });

  it("answers network when the transport throws", async () => {
    const { client } = fakeClient({ get: new Error("offline") });

    expect(await new HttpBusinessGateway(client).getMyBusiness()).toEqual({ ok: false, code: "network" });
  });
});

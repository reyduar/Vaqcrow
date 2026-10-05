import type { AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompletenessCheckInput } from "@/application/ports/completeness-check-port";
import { HttpCompletenessGateway } from "./http-completeness-gateway";

const INPUT: CompletenessCheckInput = {
  documents: [
    { kind: "sales-declarations", present: true },
    { kind: "cuit", present: true },
    { kind: "articles-of-incorporation", present: false }
  ],
  photoCount: 0,
  salesMonths: [{ month: "Enero", valueArs: 1000 }]
};

const WIRE_RESULT = {
  complete: false,
  findings: [
    { code: "missing_document", severity: "gap", detail: "Falta un documento obligatorio: Estatuto." }
  ]
};

interface Call {
  readonly url: string;
  readonly data: unknown;
  readonly config: Record<string, unknown> | undefined;
}

function fakeClient(fake: { post?: { status: number; data: unknown } | Error }) {
  const calls: Call[] = [];
  const client = {
    post: async (url: string, data: unknown, config: Record<string, unknown> | undefined) => {
      calls.push({ url, data, config });
      if (fake.post instanceof Error) throw fake.post;
      return fake.post ?? { status: 200, data: { result: WIRE_RESULT } };
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

afterEach(() => vi.restoreAllMocks());

describe("HttpCompletenessGateway.check", () => {
  it("posts the JSON input with the Bearer token and unwraps the result envelope", async () => {
    const { client, calls } = fakeClient({});
    const gateway = new HttpCompletenessGateway(client, async () => "token-123");

    const outcome = await gateway.check(INPUT);

    expect(outcome).toEqual({ ok: true, result: WIRE_RESULT });
    const call = calls[0]!;
    expect(call.url).toBe("/completeness-check");
    expect(call.data).toEqual(INPUT);
    expect(call.config?.["headers"]).toEqual({ Authorization: "Bearer token-123" });
  });

  it("never puts an owner in the body", async () => {
    const { client, calls } = fakeClient({});
    const gateway = new HttpCompletenessGateway(client, async () => "token");

    await gateway.check(INPUT);

    const body = calls[0]!.data as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["documents", "photoCount", "salesMonths"]);
    expect(body["ownerUserId"]).toBeUndefined();
    expect(body["owner_user_id"]).toBeUndefined();
  });

  it("sends no Authorization header when there is no token", async () => {
    const { client, calls } = fakeClient({});
    const gateway = new HttpCompletenessGateway(client, async () => null);

    await gateway.check(INPUT);

    expect(calls[0]!.config?.["headers"]).toEqual({});
  });

  it("maps the API's 400 errors envelope to invalid_request", async () => {
    const { client } = fakeClient({ post: { status: 400, data: { errors: [{ field: "salesMonths", code: "invalid" }] } } });

    expect(await new HttpCompletenessGateway(client).check(INPUT)).toEqual({ ok: false, code: "invalid_request" });
  });

  it("prefers the sanitized code of a 503 envelope", async () => {
    const { client } = fakeClient({ post: { status: 503, data: { code: "unavailable" } } });

    expect(await new HttpCompletenessGateway(client).check(INPUT)).toEqual({ ok: false, code: "unavailable" });
  });

  it("answers unavailable for a malformed success body", async () => {
    const { client } = fakeClient({ post: { status: 200, data: { result: { complete: "yes", findings: [] } } } });

    expect(await new HttpCompletenessGateway(client).check(INPUT)).toEqual({ ok: false, code: "unavailable" });
  });

  it("drops a finding with an unknown code or severity instead of rendering it", async () => {
    for (const bad of [
      { code: "made_up", severity: "gap", detail: "x" },
      { code: "missing_document", severity: "critical", detail: "x" },
      { code: "missing_document", severity: "gap", detail: "" }
    ]) {
      const { client } = fakeClient({ post: { status: 200, data: { result: { complete: false, findings: [bad] } } } });
      expect(await new HttpCompletenessGateway(client).check(INPUT)).toEqual({ ok: false, code: "unavailable" });
    }
  });

  it("answers network when the transport throws", async () => {
    const { client } = fakeClient({ post: new Error("socket hang up") });

    expect(await new HttpCompletenessGateway(client).check(INPUT)).toEqual({ ok: false, code: "network" });
  });
});

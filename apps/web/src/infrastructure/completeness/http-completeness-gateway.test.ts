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

  it("omits the Authorization header when the token is malformed", async () => {
    const { client, calls } = fakeClient({});
    // A space or CR/LF is outside RFC 6750's b64token, so it must never reach a header.
    const gateway = new HttpCompletenessGateway(client, async () => "bad token\r\nInjected: x");

    const outcome = await gateway.check(INPUT);

    expect(outcome).toEqual({ ok: true, result: WIRE_RESULT });
    expect(calls).toHaveLength(1);
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

  it("accepts the content-relevance findings the API now emits, without collapsing the result", async () => {
    const result = {
      complete: false,
      findings: [
        { code: "missing_document", severity: "gap", detail: "Falta un documento obligatorio: Estatuto." },
        {
          code: "content_irrelevant",
          severity: "gap",
          detail: "El contenido de «Constancia de CUIT» no parece corresponder a ese documento."
        },
        {
          code: "content_unverified",
          severity: "warning",
          detail: "No pudimos verificar el contenido de «Estatuto»."
        }
      ]
    };
    const { client } = fakeClient({ post: { status: 200, data: { result } } });

    // A valid content finding must render, not blank the whole section.
    expect(await new HttpCompletenessGateway(client).check(INPUT)).toEqual({ ok: true, result });
  });

  it("still collapses the result when a code is outside the vocabulary", async () => {
    const { client } = fakeClient({
      post: {
        status: 200,
        data: {
          result: {
            complete: false,
            findings: [{ code: "content_made_up", severity: "gap", detail: "x" }]
          }
        }
      }
    });

    expect(await new HttpCompletenessGateway(client).check(INPUT)).toEqual({ ok: false, code: "unavailable" });
  });

  it("answers unavailable when a finding is outside the vocabulary", async () => {
    const validFinding = { code: "missing_document", severity: "gap", detail: "Falta un documento obligatorio: Estatuto." };
    for (const bad of [
      { code: "made_up", severity: "gap", detail: "x" },
      { code: "missing_document", severity: "critical", detail: "x" },
      { code: "missing_document", severity: "gap", detail: "" }
    ]) {
      const { client } = fakeClient({
        post: { status: 200, data: { result: { complete: false, findings: [validFinding, bad] } } }
      });
      // Fail-closed: the whole envelope collapses, so the valid finding is
      // never partially trusted alongside an unverifiable one.
      expect(await new HttpCompletenessGateway(client).check(INPUT)).toEqual({ ok: false, code: "unavailable" });
    }
  });

  it("answers network when the transport throws", async () => {
    const { client } = fakeClient({ post: new Error("socket hang up") });

    expect(await new HttpCompletenessGateway(client).check(INPUT)).toEqual({ ok: false, code: "network" });
  });
});

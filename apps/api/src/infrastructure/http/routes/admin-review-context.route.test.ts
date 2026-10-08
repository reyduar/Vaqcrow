import { parseApplicationId } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../build-app.js";
import { bearer, fakeAuthPort } from "../test-support/auth.js";
import type { AdminReviewContextPort } from "../../../application/ports/admin-review-context-port.js";

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const URL = `/application-reviews/${APPLICATION_ID}/context`;
const CONTEXT = {
  applicationReview: { applicationId: APPLICATION_ID, state: "human_review" },
  smeRequest: {
    applicationId: APPLICATION_ID,
    ownerUserId: "00000000-0000-4000-8000-000000000001",
    request: {
      smeReference: "sme-001",
      declaredTotalArs: 1_500_000,
      periodStart: "2026-01",
      periodEnd: "2026-06",
      simuladoLabel: "SIMULADO"
    }
  },
  company: null,
  documents: [],
  assessment: null,
  latestHumanDecision: null,
  documentVerdicts: [
    {
      documentId: "55555555-5555-4555-8555-555555555555",
      verdict: "valid",
      actor: "Admin Vaqcrow",
      updatedAt: "2026-10-07T12:00:00.000Z"
    }
  ]
} as const;

function appFor(result: Awaited<ReturnType<AdminReviewContextPort["get"]>>): FastifyInstance {
  const context: AdminReviewContextPort = { get: vi.fn().mockResolvedValue(result) };
  return buildApp({ adminReviewContext: { context }, auth: { port: fakeAuthPort() } });
}

describe("GET /application-reviews/:applicationId/context", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns the aggregated context for an ADMIN", async () => {
    app = appFor({ ok: true, value: CONTEXT });

    const response = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(CONTEXT);
  });

  it.each(["PYME", "INVERSOR"] as const)("rejects %s before calling the context port", async (role) => {
    app = appFor({ ok: true, value: CONTEXT });

    const response = await app.inject({ method: "GET", url: URL, headers: bearer(role) });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
  });

  it("maps a malformed application id to 400", async () => {
    app = appFor({ ok: true, value: CONTEXT });

    const response = await app.inject({ method: "GET", url: "/application-reviews/not-an-id/context", headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it.each([
    [{ code: "not_found" }, 404, { code: "not_found" }],
    [{ code: "unavailable" }, 503, { code: "unavailable" }]
  ] as const)("sanitizes use-case error %o", async (result, status, body) => {
    app = appFor({ ok: false, error: result });

    const response = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(body);
    expect(response.body).not.toContain("provider");
  });

  it("maps a thrown context dependency to a sanitized 503", async () => {
    const context: AdminReviewContextPort = {
      get: vi.fn().mockRejectedValue(new Error("raw database detail"))
    };
    app = buildApp({ adminReviewContext: { context }, auth: { port: fakeAuthPort() } });

    const response = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
    expect(response.body).not.toContain("raw database detail");
  });
});

import { parseApplicationId } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetDocumentVerdictResult } from "../../../application/use-cases/set-document-verdict.js";
import { buildApp } from "../build-app.js";
import { bearer, fakeAuthPort, principalFor } from "../test-support/auth.js";

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const DOCUMENT_ID = "55555555-5555-4555-8555-555555555555";
const URL = `/application-reviews/${APPLICATION_ID}/documents/${DOCUMENT_ID}/verdict`;
const ADMIN = principalFor("ADMIN");

const VERDICT = {
  documentId: DOCUMENT_ID,
  verdict: "invalid",
  actor: ADMIN.displayName,
  updatedAt: "2026-10-07T12:00:00.000Z"
} as const;

function appFor(result: SetDocumentVerdictResult | Error) {
  const set = result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result);
  const app = buildApp({ documentVerdict: { set }, auth: { port: fakeAuthPort() } });
  return { app, set };
}

describe("PUT /application-reviews/:applicationId/documents/:documentId/verdict", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it.each([true, false])(
    "records the verdict as the authenticated admin and answers 200 (applied: %s)",
    async (applied) => {
      const built = appFor({ ok: true, value: { applied, verdict: VERDICT } });
      app = built.app;

      const response = await app.inject({
        method: "PUT",
        url: URL,
        headers: bearer("ADMIN"),
        payload: { verdict: "invalid" }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ applied, verdict: VERDICT });
      expect(built.set).toHaveBeenCalledExactlyOnceWith({
        applicationId: APPLICATION_ID,
        documentId: DOCUMENT_ID,
        verdict: "invalid",
        actor: { userId: ADMIN.userId, displayName: ADMIN.displayName }
      });
    }
  );

  it.each(["PYME", "INVERSOR"] as const)("rejects %s before calling the use case", async (role) => {
    const built = appFor({ ok: true, value: { applied: true, verdict: VERDICT } });
    app = built.app;

    const response = await app.inject({ method: "PUT", url: URL, headers: bearer(role), payload: { verdict: "valid" } });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
    expect(built.set).not.toHaveBeenCalled();
  });

  it.each([
    ["a malformed application id", `/application-reviews/not-an-id/documents/${DOCUMENT_ID}/verdict`, { verdict: "valid" }],
    ["a malformed document id", `/application-reviews/${APPLICATION_ID}/documents/nope/verdict`, { verdict: "valid" }],
    ["an unknown verdict", URL, { verdict: "approved" }],
    ["a missing verdict", URL, {}],
    ["a body actor (never accepted from the client)", URL, { verdict: "valid", actor: "Mallory" }],
    ["a body actor user id", URL, { verdict: "valid", actorUserId: "00000000-0000-4000-8000-000000000009" }],
    ["a non-object body", URL, ["valid"]]
  ])("answers 400 for %s without calling the use case", async (_label, url, payload) => {
    const built = appFor({ ok: true, value: { applied: true, verdict: VERDICT } });
    app = built.app;

    const response = await app.inject({ method: "PUT", url, headers: bearer("ADMIN"), payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(built.set).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, error: { code: "not_found" } }, 404, { code: "not_found" }],
    [
      { ok: false, error: { code: "state_conflict", actualState: "approved" } },
      409,
      { code: "state_conflict", actualState: "approved" }
    ],
    [{ ok: false, error: { code: "unavailable" } }, 503, { code: "unavailable" }]
  ] as const)("sanitizes use-case error %o", async (result, status, body) => {
    app = appFor(result).app;

    const response = await app.inject({ method: "PUT", url: URL, headers: bearer("ADMIN"), payload: { verdict: "valid" } });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(body);
  });

  it("maps a thrown use case to a sanitized 503", async () => {
    app = appFor(new Error("raw database detail")).app;

    const response = await app.inject({ method: "PUT", url: URL, headers: bearer("ADMIN"), payload: { verdict: "valid" } });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
    expect(response.body).not.toContain("raw database detail");
  });

  it("allows PUT in the CORS preflight so the browser console can send a verdict", async () => {
    app = buildApp({
      documentVerdict: { set: vi.fn() },
      auth: { port: fakeAuthPort() },
      cors: { allowedOrigins: ["https://web.example.test"] }
    });

    const response = await app.inject({
      method: "OPTIONS",
      url: URL,
      headers: { origin: "https://web.example.test", "access-control-request-method": "PUT" }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("PUT");
  });
});

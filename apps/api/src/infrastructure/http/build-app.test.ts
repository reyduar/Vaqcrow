import { correlationIdSchema } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./build-app.js";
import { bearer, fakeAuthPort } from "./test-support/auth.js";

const CALLER_CORRELATION_ID = "123e4567-e89b-42d3-a456-426614174000";

// Ad-hoc probe routes have no entry in the production policy table; these tests
// are about request ids, not authorization, so they opt into an open policy.
const openPolicy = { auth: { port: fakeAuthPort(), policy: () => ({ kind: "public" as const }) } };

describe("buildApp", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it("fails synchronously when Web Crypto cannot generate UUIDs", () => {
    vi.stubGlobal("crypto", {});

    expect(() => buildApp()).toThrow();
  });

  it("responds to GET /health with 200 via inject(), without opening a network listener", async () => {
    app = buildApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(app.server.listening).toBe(false);
  });

  it("returns a JSON body reporting ok status from the health handler", async () => {
    app = buildApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns 404 for a route that was never registered, proving routing is specific", async () => {
    app = buildApp();

    const response = await app.inject({ method: "GET", url: "/does-not-exist" });

    expect(response.statusCode).toBe(404);
  });

  it("returns the server-generated request ID in the response header", async () => {
    app = buildApp(openPolicy);
    app.get("/request-id", async (request) => ({ requestId: request.id }));

    const response = await app.inject({ method: "GET", url: "/request-id" });
    const requestId = response.json<{ requestId: string }>().requestId;

    expect(correlationIdSchema.safeParse(requestId).success).toBe(true);
    expect(response.headers["x-correlation-id"]).toBe(requestId);
  });

  it("does not reuse a caller-supplied correlation ID", async () => {
    app = buildApp(openPolicy);
    app.get("/request-id", async (request) => ({ requestId: request.id }));

    const response = await app.inject({
      method: "GET",
      url: "/request-id",
      headers: { "x-correlation-id": CALLER_CORRELATION_ID }
    });
    const requestId = response.json<{ requestId: string }>().requestId;

    expect(requestId).not.toBe(CALLER_CORRELATION_ID);
    expect(response.headers["x-correlation-id"]).toBe(requestId);
  });

  it("includes a valid correlation ID on 404 responses", async () => {
    app = buildApp();

    const response = await app.inject({ method: "GET", url: "/missing" });
    const responseHeader = response.headers["x-correlation-id"];

    expect(correlationIdSchema.safeParse(responseHeader).success).toBe(true);
  });

  it("preserves the handler request ID on 500 responses", async () => {
    app = buildApp(openPolicy);
    let capturedRequestId: string | undefined;
    app.get("/failure", async (request) => {
      capturedRequestId = request.id;
      throw new Error("test failure");
    });

    const response = await app.inject({ method: "GET", url: "/failure" });

    expect(response.statusCode).toBe(500);
    expect(correlationIdSchema.safeParse(capturedRequestId).success).toBe(true);
    expect(response.headers["x-correlation-id"]).toBe(capturedRequestId);
  });

  describe("error handler", () => {
    const SENTINEL = "SENTINEL-handler-detail-41c9";
    const ORIGIN = "https://vaqcrow-web.example.com";

    function sentinelError(name: string, statusCode?: number): Error {
      const error = new Error(SENTINEL) as Error & { statusCode?: number };
      error.name = name;
      if (statusCode !== undefined) error.statusCode = statusCode;
      return error;
    }

    it("answers an uncaught handler exception with a sanitized 500 and logs only its name", async () => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      app = buildApp({ ...openPolicy, cors: { allowedOrigins: [ORIGIN] } });
      app.get("/explodes", async () => {
        throw sentinelError("HandlerCrashError");
      });

      const response = await app.inject({ method: "GET", url: "/explodes", headers: { origin: ORIGIN } });

      expect(response.statusCode).toBe(500);
      expect(response.headers["content-type"]).toMatch(/^application\/json/);
      expect(response.body).toBe(JSON.stringify({ code: "internal" }));
      const correlationId = response.headers["x-correlation-id"];
      expect(correlationIdSchema.safeParse(correlationId).success).toBe(true);
      expect(response.headers["access-control-allow-origin"]).toBe(ORIGIN);
      expect(logged).toHaveBeenCalledTimes(1);
      expect(logged).toHaveBeenCalledWith("[HttpErrorHandler] unhandled error", {
        cause: "HandlerCrashError",
        statusCode: 500,
        correlationId
      });
      expect(JSON.stringify(logged.mock.calls)).not.toContain(SENTINEL);
      expect(JSON.stringify(response.headers)).not.toContain(SENTINEL);
    });

    it("sanitizes an error that claims a 4xx status but is not Fastify's own", async () => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      app = buildApp(openPolicy);
      app.get("/claims-404", async () => {
        throw sentinelError("LibraryNotFoundError", 404);
      });

      const response = await app.inject({ method: "GET", url: "/claims-404" });

      expect(response.statusCode).toBe(500);
      expect(response.body).toBe(JSON.stringify({ code: "internal" }));
      expect(logged).toHaveBeenCalledWith("[HttpErrorHandler] unhandled error", {
        cause: "LibraryNotFoundError",
        statusCode: 404,
        correlationId: response.headers["x-correlation-id"]
      });
      expect(JSON.stringify(logged.mock.calls)).not.toContain(SENTINEL);
    });

    it.each([
      [
        "malformed JSON",
        "application/json",
        '{"a": ',
        400,
        {
          statusCode: 400,
          code: "FST_ERR_CTP_INVALID_JSON_BODY",
          error: "Bad Request",
          message: "Body is not valid JSON but content-type is set to 'application/json'"
        }
      ],
      [
        "an unsupported media type",
        "text/xml",
        "<a/>",
        415,
        {
          statusCode: 415,
          code: "FST_ERR_CTP_INVALID_MEDIA_TYPE",
          error: "Unsupported Media Type",
          message: "Unsupported Media Type"
        }
      ]
    ])("keeps Fastify's own 4xx body unchanged for %s", async (_label, contentType, payload, status, body) => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      app = buildApp(openPolicy);
      app.post("/echo", async () => ({ reached: true }));

      const response = await app.inject({
        method: "POST",
        url: "/echo",
        headers: { "content-type": contentType },
        payload
      });

      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual(body);
      expect(logged).not.toHaveBeenCalled();
    });
  });

  describe("notification dependency", () => {
    it("registers the notification routes when the dependency is present", async () => {
      const repository = {
        resolveRecipientsByRole: async () => ({ ok: true as const, recipients: [] }),
        resolveRecipientsByUserIds: async () => ({ ok: true as const, recipients: [] }),
        insertIfAbsent: async () => ({ ok: true as const, inserted: true, id: "notification-1" }),
        markEmailSent: async () => undefined,
        listByRecipient: async () => ({ ok: true as const, notifications: [] }),
        countUnread: async () => ({ ok: true as const, unread: 0 }),
        markRead: async () => ({ ok: true as const, changed: false }),
        markAllRead: async () => ({ ok: true as const, updated: 0 })
      };
      app = buildApp({ auth: { port: fakeAuthPort() }, notification: { repository } });

      const response = await app.inject({ method: "GET", url: "/notifications", headers: bearer("PYME") });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ notifications: [] });
    });
  });

  describe("completeness check dependency", () => {
    it("registers POST /completeness-check when the dependency is present", async () => {
      const checker = {
        check: async () => ({ complete: true, findings: [] })
      };
      app = buildApp({ auth: { port: fakeAuthPort() }, completenessCheck: { checker } });

      const response = await app.inject({
        method: "POST",
        url: "/completeness-check",
        headers: bearer("PYME"),
        payload: {
          documents: [
            { kind: "sales-declarations", present: true },
            { kind: "cuit", present: true },
            { kind: "articles-of-incorporation", present: true }
          ],
          photoCount: 1,
          salesMonths: [
            { month: "Enero", valueArs: 1 },
            { month: "Febrero", valueArs: 1 },
            { month: "Marzo", valueArs: 1 },
            { month: "Abril", valueArs: 1 },
            { month: "Mayo", valueArs: 1 },
            { month: "Junio", valueArs: 1 }
          ]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ result: { complete: true, findings: [] } });
    });
  });

  describe("marketplace dependency", () => {
    it("registers the public marketplace listing when the dependency is present", async () => {
      const campaigns = { listPublished: async () => ({ ok: true as const, value: [] }) };
      app = buildApp({ marketplace: { campaigns } });

      const response = await app.inject({ method: "GET", url: "/marketplace/campaigns" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ items: [] });
    });
  });

  describe("favorite dependency", () => {
    it("registers the favorites surface when the dependency is present", async () => {
      const favorites = {
        listCampaignIds: async () => ({ ok: true as const, value: [] }),
        add: async () => ({ ok: true as const, value: { applied: true } }),
        remove: async () => ({ ok: true as const, value: { applied: true } })
      };
      app = buildApp({ auth: { port: fakeAuthPort() }, favorite: { favorites } });

      const response = await app.inject({ method: "GET", url: "/favorites", headers: bearer("INVERSOR") });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ campaignIds: [] });
    });
  });

  describe("CORS", () => {
    const ALLOWED_ORIGIN = "https://vaqcrow-web.example.com";
    const DISALLOWED_ORIGIN = "https://not-allowed.example.com";

    it("answers a preflight for an allowed origin with 204 and the matching allow-origin header", async () => {
      app = buildApp({ cors: { allowedOrigins: [ALLOWED_ORIGIN] } });

      const response = await app.inject({
        method: "OPTIONS",
        url: "/health",
        headers: {
          origin: ALLOWED_ORIGIN,
          "access-control-request-method": "GET"
        }
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
    });

    it("sets the allow-origin and exposed-headers on an ordinary request from an allowed origin", async () => {
      app = buildApp({ cors: { allowedOrigins: [ALLOWED_ORIGIN] } });

      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: ALLOWED_ORIGIN }
      });

      expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
      expect(response.headers["access-control-expose-headers"]).toContain("x-correlation-id");
    });

    it("allows the authorization and content-type request headers in a preflight", async () => {
      app = buildApp({ cors: { allowedOrigins: [ALLOWED_ORIGIN] } });

      const response = await app.inject({
        method: "OPTIONS",
        url: "/health",
        headers: {
          origin: ALLOWED_ORIGIN,
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization,content-type"
        }
      });

      expect(response.statusCode).toBe(204);
      const allowed = String(response.headers["access-control-allow-headers"]).toLowerCase();
      expect(allowed).toContain("authorization");
      expect(allowed).toContain("content-type");
    });

    it("omits the allow-origin header for a disallowed origin", async () => {
      app = buildApp({ cors: { allowedOrigins: [ALLOWED_ORIGIN] } });

      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: DISALLOWED_ORIGIN }
      });

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("registers no CORS handling at all when no cors option is given", async () => {
      app = buildApp();

      const getResponse = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: ALLOWED_ORIGIN }
      });
      const preflightResponse = await app.inject({
        method: "OPTIONS",
        url: "/health",
        headers: { origin: ALLOWED_ORIGIN, "access-control-request-method": "GET" }
      });

      expect(getResponse.headers["access-control-allow-origin"]).toBeUndefined();
      // With no CORS plugin registered, OPTIONS is not a route Fastify knows about.
      expect(preflightResponse.statusCode).toBe(404);
    });
  });
});

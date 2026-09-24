import { correlationIdSchema } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./build-app.js";

const CALLER_CORRELATION_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("buildApp", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.unstubAllGlobals();
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
    app = buildApp();
    app.get("/request-id", async (request) => ({ requestId: request.id }));

    const response = await app.inject({ method: "GET", url: "/request-id" });
    const requestId = response.json<{ requestId: string }>().requestId;

    expect(correlationIdSchema.safeParse(requestId).success).toBe(true);
    expect(response.headers["x-correlation-id"]).toBe(requestId);
  });

  it("does not reuse a caller-supplied correlation ID", async () => {
    app = buildApp();
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
    app = buildApp();
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

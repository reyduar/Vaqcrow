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
});

import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerHealthRoute } from "./health.route.js";

describe("registerHealthRoute", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns exactly { status: 'ok' } when no dependencies are supplied (backward compatible)", async () => {
    app = Fastify();
    registerHealthRoute(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("reports ok when every probe reports ok", async () => {
    app = Fastify();
    registerHealthRoute(app, { probes: { supabase: async () => "ok" } });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", dependencies: { supabase: "ok" } });
  });

  it("reports degraded, still with HTTP 200, when a probe is unavailable", async () => {
    app = Fastify();
    registerHealthRoute(app, { probes: { supabase: async () => "unavailable" } });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "degraded", dependencies: { supabase: "unavailable" } });
  });

  it("treats a throwing probe as unavailable and never answers 5xx", async () => {
    app = Fastify();
    registerHealthRoute(app, {
      probes: {
        supabase: async () => {
          throw new Error("boom");
        }
      }
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "degraded", dependencies: { supabase: "unavailable" } });
  });

  it("aggregates multiple probes, degrading the whole report if any one is unavailable", async () => {
    app = Fastify();
    registerHealthRoute(app, {
      probes: {
        supabase: async () => "ok",
        other: async () => "unavailable"
      }
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "degraded",
      dependencies: { supabase: "ok", other: "unavailable" }
    });
  });
});

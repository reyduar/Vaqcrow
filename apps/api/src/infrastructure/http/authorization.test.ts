import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ROUTE_POLICY_KEYS } from "../../application/authorization/route-policy.js";
import type { Role } from "../../application/ports/auth-port.js";
import { buildApp } from "./build-app.js";
import { bearer, fakeAuthPort } from "./test-support/auth.js";

type Allowed = readonly Role[] | "public" | "any";

// Written independently of route-policy.ts on purpose: this is the spec table.
const MATRIX: ReadonlyArray<readonly [string, string, Allowed]> = [
  ["GET", "/health", "public"],
  ["POST", "/sme-requests", ["PYME"]],
  ["GET", "/sme-requests/:applicationId", ["PYME"]],
  ["GET", "/businesses/:businessId/sales-periods", ["PYME", "ADMIN"]],
  ["POST", "/businesses/:businessId/sales-periods", ["PYME"]],
  ["POST", "/assessments", ["ADMIN"]],
  ["POST", "/application-reviews/:applicationId/assessments", ["ADMIN"]],
  ["GET", "/application-reviews/:applicationId/assessment", ["ADMIN"]],
  ["GET", "/application-reviews/:applicationId/manual-review", ["ADMIN"]],
  ["POST", "/application-reviews/:applicationId/decisions", ["ADMIN"]],
  ["GET", "/application-reviews/:applicationId/decisions", ["ADMIN"]],
  ["POST", "/campaigns", ["ADMIN"]],
  ["GET", "/campaigns/:campaignId", "any"],
  ["GET", "/campaigns/:campaignId/transactions/:hash", "any"],
  ["POST", "/campaigns/:campaignId/invocations", "any"],
  ["POST", "/campaigns/:campaignId/invocations/submission", "any"],
  ["POST", "/revenue-share-distributions", ["PYME"]],
  ["POST", "/revenue-share-distributions/:distributionId/submission", ["PYME"]],
  ["GET", "/revenue-share-distributions/:distributionId", ["PYME", "ADMIN"]],
  ["POST", "/funding-intents", ["ADMIN"]],
  ["POST", "/funding-intents/:intentId/submission", ["ADMIN"]],
  ["GET", "/funding-intents/:intentId", ["ADMIN"]]
];

const ROLES: readonly Role[] = ["PYME", "INVERSOR", "ADMIN"];
const stub = {} as never;

function concreteUrl(pattern: string): string {
  return pattern.replace(/:\w+/g, "11111111-1111-4111-8111-111111111111");
}

type AuthDependency = NonNullable<NonNullable<Parameters<typeof buildApp>[0]>["auth"]>;

function buildFullApp(auth?: AuthDependency): {
  app: FastifyInstance;
  routes: Array<{ method: string; url: string }>;
} {
  const routes: Array<{ method: string; url: string }> = [];
  const app = buildApp({
    applicationReviewRepository: stub,
    fundingIntent: stub,
    revenueShareDistribution: stub,
    assessment: stub,
    applicationAssessment: stub,
    campaign: stub,
    salesFeed: stub,
    smeRequest: stub,
    observeRoutes: (route) => routes.push(route),
    ...(auth ? { auth } : {})
  });
  return { app, routes };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("default-deny authorization", () => {
  describe.each(MATRIX)("%s %s", (method, pattern, allowed) => {
    const url = concreteUrl(pattern);

    async function call(headers: Record<string, string>) {
      app = buildFullApp({ port: fakeAuthPort() }).app;
      return app.inject({ method: method as "GET" | "POST", url, headers, ...(method === "POST" ? { payload: {} } : {}) });
    }

    if (allowed === "public") {
      it("is reachable without a token", async () => {
        expect((await call({})).statusCode).toBe(200);
      });
      return;
    }

    it("answers 401 without a token", async () => {
      const response = await call({});
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ code: "unauthenticated" });
    });

    it("answers 401 for a token the provider rejects", async () => {
      expect((await call({ authorization: "Bearer garbage" })).statusCode).toBe(401);
    });

    it("answers 401 for an inactive principal, whatever the role", async () => {
      for (const role of ROLES) {
        expect((await call(bearer(role, "inactive"))).statusCode).toBe(401);
      }
    });

    it.each(ROLES)("role %s is authorized exactly as the policy table says", async (role) => {
      const response = await call(bearer(role));
      const permitted = allowed === "any" || allowed.includes(role);
      if (permitted) {
        expect([401, 403]).not.toContain(response.statusCode);
      } else {
        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual({ code: "forbidden" });
      }
    });
  });

  it("answers 503 when the auth port is unavailable", async () => {
    app = buildFullApp({
      port: fakeAuthPort({ verifyAccessToken: async () => ({ ok: false, error: { code: "unavailable" } }) })
    }).app;

    const response = await app.inject({ method: "GET", url: "/campaigns/abc", headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("denies a matched route that has no policy entry with 403, even for ADMIN", async () => {
    app = buildApp({ auth: { port: fakeAuthPort() } });
    app.get("/unlisted", async () => ({ leaked: true }));

    const response = await app.inject({ method: "GET", url: "/unlisted", headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
  });

  it("lets Fastify answer 404 for a path that matches no route", async () => {
    app = buildApp({ auth: { port: fakeAuthPort() } });
    expect((await app.inject({ method: "GET", url: "/nope" })).statusCode).toBe(404);
  });

  it("denies every non-public route (401) when no auth dependency is given", async () => {
    app = buildApp({ campaign: stub, smeRequest: stub });

    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/campaigns/abc", headers: bearer("ADMIN") })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/sme-requests", payload: {} })).statusCode).toBe(401);
  });

  it("does not call the port for public routes or CORS preflights", async () => {
    const verifyAccessToken = vi.fn();
    app = buildApp({
      auth: { port: { verifyAccessToken } },
      cors: { allowedOrigins: ["https://web.example.test"] }
    });

    await app.inject({ method: "GET", url: "/health" });
    await app.inject({
      method: "OPTIONS",
      url: "/campaigns",
      headers: { origin: "https://web.example.test", "access-control-request-method": "POST" }
    });

    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("attaches the verified principal to the request", async () => {
    app = buildApp({ auth: { port: fakeAuthPort(), policy: () => ({ kind: "authenticated" }) } });
    app.get("/whoami", async (request) => request.principal);

    const response = await app.inject({ method: "GET", url: "/whoami", headers: bearer("PYME") });

    expect(response.json()).toMatchObject({ role: "PYME", status: "active", displayName: "Test PYME" });
  });

  it("includes CORS headers on a 401 so the browser can read it", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      cors: { allowedOrigins: ["https://web.example.test"] },
      campaign: stub
    });

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/abc",
      headers: { origin: "https://web.example.test" }
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers["access-control-allow-origin"]).toBe("https://web.example.test");
  });

  describe("coverage", () => {
    it("has an explicit policy entry for every registered route", () => {
      const built = buildFullApp({ port: fakeAuthPort() });
      app = built.app;
      const registered = built.routes.filter((route) => route.method !== "HEAD" && route.method !== "OPTIONS");

      expect(registered.length).toBeGreaterThanOrEqual(MATRIX.length);
      const missing = registered
        .map((route) => `${route.method} ${route.url}`)
        .filter((key) => !ROUTE_POLICY_KEYS.includes(key));
      expect(missing).toEqual([]);
    });
  });
});

describe("policy table", () => {
  it("matches the specification matrix exactly", () => {
    expect([...ROUTE_POLICY_KEYS].sort()).toEqual(MATRIX.map(([method, pattern]) => `${method} ${pattern}`).sort());
  });
});

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
  // Public marketplace listing (#414/WU1) and campaign image (#414/WU3):
  // reachable without a token.
  ["GET", "/marketplace/campaigns", "public"],
  ["GET", "/marketplace/campaigns/:campaignId/image", "public"],
  // Account-gated campaign detail (#422/WU1): any signed-in role may open a
  // published campaign; it is not public.
  ["GET", "/marketplace/campaigns/:campaignId", "any"],
  ["POST", "/sme-requests", ["PYME"]],
  ["GET", "/sme-requests", ["ADMIN"]],
  ["GET", "/sme-requests/:applicationId", ["PYME"]],
  // Application completeness check (#402/T1a): declared-data check for the PyME.
  ["POST", "/completeness-check", ["PYME"]],
  ["POST", "/businesses", ["PYME"]],
  ["GET", "/businesses/mine", ["PYME"]],
  // Wallet connection (#407/T1b, extended by #426/WU4): the route handlers and
  // use cases are role-agnostic, so an INVERSOR persists its own Stellar key
  // exactly like a PYME. ADMIN is still not allowed.
  ["POST", "/profile/wallet/challenge", ["PYME", "INVERSOR"]],
  ["POST", "/profile/wallet", ["PYME", "INVERSOR"]],
  ["GET", "/profile/wallet", ["PYME", "INVERSOR"]],
  ["POST", "/storage/uploads", ["PYME"]],
  ["DELETE", "/storage/uploads", ["PYME"]],
  ["GET", "/storage/uploads", ["ADMIN"]],
  ["GET", "/businesses/:businessId/sales-periods", ["PYME", "ADMIN"]],
  ["POST", "/businesses/:businessId/sales-periods", ["PYME"]],
  ["POST", "/assessments", ["ADMIN"]],
  ["POST", "/application-reviews/:applicationId/assessments", ["ADMIN"]],
  ["GET", "/application-reviews/:applicationId/assessment", ["ADMIN"]],
  ["GET", "/application-reviews/:applicationId/context", ["ADMIN"]],
  ["GET", "/application-reviews/:applicationId/manual-review", ["ADMIN"]],
  ["POST", "/application-reviews/:applicationId/decisions", ["ADMIN"]],
  ["GET", "/application-reviews/:applicationId/decisions", ["ADMIN"]],
  // Per-document KYC/KYB verdicts (#410/U1): only an admin records them.
  ["PUT", "/application-reviews/:applicationId/documents/:documentId/verdict", ["ADMIN"]],
  // Vault deployment lifecycle (#410/T5b): the admin deploys or retries and
  // reads the read-only detail; both are ADMIN-only.
  ["POST", "/application-reviews/:applicationId/deployment", ["ADMIN"]],
  ["GET", "/application-reviews/:applicationId/deployment", ["ADMIN"]],
  ["POST", "/campaigns", ["ADMIN"]],
  ["GET", "/admin/rates/current", ["ADMIN"]],
  ["POST", "/admin/rates", ["ADMIN"]],
  ["GET", "/campaigns/:campaignId", "any"],
  ["GET", "/campaigns/:campaignId/transactions/:hash", "any"],
  ["POST", "/campaigns/:campaignId/invocations", "any"],
  ["POST", "/campaigns/:campaignId/invocations/submission", "any"],
  ["POST", "/revenue-share-distributions", ["PYME"]],
  ["POST", "/revenue-share-distributions/:distributionId/submission", ["PYME"]],
  ["GET", "/revenue-share-distributions/:distributionId", ["PYME", "ADMIN"]],
  ["POST", "/funding-intents", ["ADMIN"]],
  ["POST", "/funding-intents/:intentId/submission", ["ADMIN"]],
  ["GET", "/funding-intents/:intentId", ["ADMIN"]],
  // In-app notifications (#382/T1c): every signed-in role reads and marks only
  // its own rows; the recipient is the verified principal, never the request.
  ["GET", "/notifications", "any"],
  ["GET", "/notifications/unread-count", "any"],
  ["POST", "/notifications/:notificationId/read", "any"],
  ["POST", "/notifications/read-all", "any"],
  // Per-account favorites (#414/WU2): any signed-in role lists, adds and
  // removes only its own rows; the owner is the verified principal.
  ["GET", "/favorites", "any"],
  ["PUT", "/favorites/:campaignId", "any"],
  ["DELETE", "/favorites/:campaignId", "any"],
  // Investor's simulated KYC (#422/WU4): any signed-in role reads and records
  // only its own verification state; the owner is the verified principal.
  ["GET", "/investor-kyc", "any"],
  ["POST", "/investor-kyc", "any"],
  // The investor's portfolio (#426/WU1): only an investor reads its own
  // positions and distributions.
  ["GET", "/portfolio", ["INVERSOR"]]
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
    adminReviewContext: stub,
    documentVerdict: stub,
    campaignDeployment: stub,
    fundingIntent: stub,
    revenueShareDistribution: stub,
    assessment: stub,
    applicationAssessment: stub,
    campaign: stub,
    salesFeed: stub,
    smeRequest: stub,
    storage: stub,
    business: stub,
    wallet: stub,
    notification: stub,
    completenessCheck: stub,
    rateTable: stub,
    // The public marketplace routes are actually invoked by the matrix (unlike
    // the other stubs), so the repository answers an empty list and a real image
    // descriptor, and the storage port returns one byte.
    marketplace: {
      campaigns: {
        listPublished: async () => ({ ok: true as const, value: [] }),
        findPublishedImage: async () => ({
          ok: true as const,
          value: { objectPath: "owner/photo/a.png", contentType: "image/png" }
        })
      },
      storage: {
        downloadObject: async () => ({ ok: true as const, value: { bytes: new Uint8Array([1]), contentType: "image/png" } })
      },
      // The account-gated detail route (#422/WU1) is registered so the matrix
      // exercises it; the probe answers before the handler runs.
      detail: { findPublished: async () => ({ ok: true as const, value: undefined }) }
    },
    favorite: stub,
    investorKyc: stub,
    portfolio: stub,
    observeRoutes: (route) => routes.push(route),
    ...(auth ? { auth } : {})
  });
  return { app, routes };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
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
      app = buildFullApp({ port: fakeAuthPort() }).app;
      // A route-level probe: preValidation only runs once onRequest (the
      // authorization hook) let the request through, so answering from it
      // proves the request reached the route with the verified principal.
      const probe = vi.fn();
      app.addHook("preValidation", async (request, reply) => {
        probe(request.routeOptions.url);
        return reply.code(200).send({ reachedRoute: request.routeOptions.url, role: request.principal?.role });
      });

      const response = await app.inject({
        method: method as "GET" | "POST",
        url,
        headers: bearer(role),
        ...(method === "POST" ? { payload: {} } : {})
      });

      const permitted = allowed === "any" || allowed.includes(role);
      if (permitted) {
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ reachedRoute: pattern, role });
        expect(probe).toHaveBeenCalledExactlyOnceWith(pattern);
      } else {
        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual({ code: "forbidden" });
        expect(probe).not.toHaveBeenCalled();
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

describe("sanitized denials", () => {
  const unavailablePort = () =>
    fakeAuthPort({ verifyAccessToken: async () => ({ ok: false, error: { code: "unavailable" } }) });

  type Scenario = readonly [label: string, port: () => ReturnType<typeof fakeAuthPort>, headers: Record<string, string>];

  function scenariosFor(allowed: Allowed): Scenario[] {
    const scenarios: Scenario[] = [
      ["no token", fakeAuthPort, {}],
      ["a malformed authorization header", fakeAuthPort, { authorization: "Basic abc" }],
      ["a rejected token", fakeAuthPort, { authorization: "Bearer garbage" }],
      ["an inactive principal", fakeAuthPort, bearer("ADMIN", "inactive")],
      ["an unavailable auth provider", unavailablePort, bearer("ADMIN")]
    ];
    const forbidden = allowed === "any" || allowed === "public" ? undefined : ROLES.find((role) => !allowed.includes(role));
    if (forbidden) {
      scenarios.push([`a forbidden role (${forbidden})`, fakeAuthPort, bearer(forbidden)]);
    }
    return scenarios;
  }

  const guarded = MATRIX.filter(([, , allowed]) => allowed !== "public");

  it.each(guarded)("%s %s denies with a body of exactly { code }", async (method, pattern, allowed) => {
    const seen = new Set<number>();
    for (const [label, port, headers] of scenariosFor(allowed)) {
      app = buildFullApp({ port: port() }).app;
      const response = await app.inject({
        method: method as "GET" | "POST",
        url: concreteUrl(pattern),
        headers,
        ...(method === "POST" ? { payload: {} } : {})
      });
      await app.close();
      app = undefined;

      expect([401, 403, 503], label).toContain(response.statusCode);
      seen.add(response.statusCode);
      expect(response.headers["content-type"], label).toMatch(/^application\/json/);
      const body = response.json() as Record<string, unknown>;
      expect(Object.keys(body), label).toEqual(["code"]);
      expect(["unauthenticated", "forbidden", "unavailable"], label).toContain(body["code"]);
      expect(response.body, label).toBe(JSON.stringify({ code: body["code"] }));
    }
    expect(seen.has(401) && seen.has(503)).toBe(true);
  });

  it("answers 503 { code } and never echoes the error when the auth port throws", async () => {
    const throwingPort = fakeAuthPort({
      verifyAccessToken: async () => {
        throw new Error("internal provider detail");
      }
    });
    app = buildFullApp({ port: throwingPort }).app;

    const response = await app.inject({ method: "GET", url: "/campaigns/abc", headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
  });

  it("logs a thrown auth port error by name and correlation id only, never its message", async () => {
    const sentinel = "SENTINEL-auth-port-detail-7f3a";
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const throwingPort = fakeAuthPort({
      verifyAccessToken: async () => {
        const error = new Error(sentinel);
        error.name = "ProviderCrashError";
        throw error;
      }
    });
    app = buildFullApp({ port: throwingPort }).app;

    const response = await app.inject({ method: "GET", url: "/campaigns/abc", headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith("[AuthorizationHook] auth port threw", {
      cause: "ProviderCrashError",
      correlationId: response.headers["x-correlation-id"]
    });
    expect(JSON.stringify(logged.mock.calls)).not.toContain(sentinel);
    expect(response.body).not.toContain(sentinel);
    expect(JSON.stringify(response.headers)).not.toContain(sentinel);
  });

  it("denies a route without a policy entry with a body of exactly { code }", async () => {
    app = buildApp({ auth: { port: fakeAuthPort() } });
    app.get("/unlisted", async () => ({ leaked: true }));

    const response = await app.inject({ method: "GET", url: "/unlisted", headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(403);
    expect(response.body).toBe(JSON.stringify({ code: "forbidden" }));
  });
});

describe("policy table", () => {
  it("matches the specification matrix exactly", () => {
    expect([...ROUTE_POLICY_KEYS].sort()).toEqual(MATRIX.map(([method, pattern]) => `${method} ${pattern}`).sort());
  });
});

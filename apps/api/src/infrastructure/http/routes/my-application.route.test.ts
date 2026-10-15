import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { parseApplicationId } from "@vaqcrow/contracts";
import type { SmeRequestRepositoryPort } from "../../../application/ports/sme-request-repository-port.js";
import { buildApp } from "../build-app.js";
import { buildAppAs } from "../test-support/auth.js";
import type { MyApplicationRouteDependencies } from "./my-application.route.js";
import type { SmeRequestRouteDependencies } from "./sme-request.route.js";

/**
 * `GET /sme-requests/mine` (#530/T1).
 *
 * The route is `PYME`-only and always scopes to `request.principal.userId`; a
 * query- or body-supplied owner is ignored. It is registered as a static route
 * beside the existing `/sme-requests/:applicationId`, which keeps working.
 */
const OWNER = "00000000-0000-4000-8000-000000000004";
const APPLICATION_ID = parseApplicationId("123e4567-e89b-42d3-a456-426614174000");
const OTHER = "00000000-0000-4000-8000-000000000009";

function deps(
  overrides: {
    readonly findByOwner?: SmeRequestRepositoryPort["findByOwner"];
    readonly findReviewStateByApplicationId?: SmeRequestRepositoryPort["findReviewStateByApplicationId"];
  } = {}
): MyApplicationRouteDependencies {
  return {
    repository: {
      findByOwner: overrides.findByOwner ?? (async () => ({ ok: true as const, value: [] })),
      findReviewStateByApplicationId:
        overrides.findReviewStateByApplicationId ??
        (async () => ({ ok: true as const, value: "human_review" as const }))
    }
  };
}

function requestedRecord(ownerUserId: string) {
  return {
    applicationId: APPLICATION_ID,
    request: {
      smeReference: "SM-1",
      declaredTotalArs: 1000,
      periodStart: "2026-01",
      periodEnd: "2026-06",
      simuladoLabel: "SIMULADO" as const
    },
    ownerUserId
  };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  app = undefined;
});

describe("GET /sme-requests/mine", () => {
  it("returns the signed-in PyME's own application and its real state", async () => {
    app = buildAppAs("PYME", {
      myApplication: deps({
        findByOwner: async () => ({ ok: true as const, value: [requestedRecord(OWNER)] }),
        findReviewStateByApplicationId: async () => ({ ok: true as const, value: "human_review" })
      })
    });

    const response = await app.inject({ method: "GET", url: "/sme-requests/mine" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      application: { applicationId: APPLICATION_ID, state: "human_review" }
    });
  });

  it("returns { application: null } for a PyME with no application", async () => {
    app = buildAppAs("PYME", { myApplication: deps() });

    const response = await app.inject({ method: "GET", url: "/sme-requests/mine" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ application: null });
  });

  it("ignores a query-supplied owner and uses the verified principal", async () => {
    const findByOwner = vi.fn(async () => ({ ok: true as const, value: [] }));
    app = buildAppAs("PYME", { myApplication: deps({ findByOwner }) });

    const response = await app.inject({ method: "GET", url: `/sme-requests/mine?owner=${OTHER}` });

    expect(response.statusCode).toBe(200);
    expect(findByOwner).toHaveBeenCalledWith(OWNER);
  });

  it("answers a sanitized 503 when the read fails", async () => {
    app = buildAppAs("PYME", {
      myApplication: deps({ findByOwner: async () => ({ ok: false as const, error: { code: "unavailable" as const } }) })
    });

    const response = await app.inject({ method: "GET", url: "/sme-requests/mine" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("answers 401 without a token (default-deny)", async () => {
    app = buildApp({ myApplication: deps() });

    const response = await app.inject({ method: "GET", url: "/sme-requests/mine" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
  });

  it.each(["INVERSOR", "ADMIN"] as const)("rejects %s before the handler runs", async (role) => {
    const findByOwner = vi.fn(async () => ({ ok: true as const, value: [] }));
    app = buildAppAs(role, { myApplication: deps({ findByOwner }) });

    const response = await app.inject({ method: "GET", url: "/sme-requests/mine" });

    expect(response.statusCode).toBe(403);
    expect(findByOwner).not.toHaveBeenCalled();
  });

  it("wins over /sme-requests/:applicationId while that route keeps working", async () => {
    const findByApplicationId = vi.fn(async () => ({ ok: false as const, error: { code: "not_found" as const } }));
    // The param route is only needed for the second assertion; the static route
    // must never reach it.
    const smeRequest = {
      repository: {
        findByApplicationId,
        findByOwner: async () => ({ ok: true as const, value: [] }),
        findReviewStateByApplicationId: async () => ({ ok: true as const, value: "human_review" as const })
      },
      salesData: { getPeriods: async () => ({ ok: true as const, value: [] }) },
      wallet: { readPublicKey: async () => ({ ok: true as const, value: null }) },
      businesses: { findByOwner: async () => ({ ok: false as const, error: { code: "not_found" as const } }) },
      notifications: { publish: async () => ({ role: "ADMIN" as const, recipients: [], inserted: 0 }) },
      generateApplicationId: () => APPLICATION_ID
    } as unknown as SmeRequestRouteDependencies;

    app = buildAppAs("PYME", { myApplication: deps(), smeRequest });

    const mine = await app.inject({ method: "GET", url: "/sme-requests/mine" });
    expect(mine.statusCode).toBe(200);
    expect(mine.json()).toEqual({ application: null });
    expect(findByApplicationId).not.toHaveBeenCalled();

    const byId = await app.inject({ method: "GET", url: `/sme-requests/${APPLICATION_ID}` });
    expect(byId.statusCode).toBe(404);
    expect(findByApplicationId).toHaveBeenCalledWith(APPLICATION_ID);
  });
});

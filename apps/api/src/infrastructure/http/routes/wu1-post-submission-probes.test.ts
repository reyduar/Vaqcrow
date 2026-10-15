import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { parseApplicationId } from "@vaqcrow/contracts";
import { buildApp } from "../build-app.js";
import { buildAppAs } from "../test-support/auth.js";
import type { MyApplicationRouteDependencies } from "./my-application.route.js";
import type { MyDocumentsRouteDependencies } from "./my-documents.route.js";
import type { SmeRequestRouteDependencies } from "./sme-request.route.js";

/** Independent verifier probes for #530/WU1 — NOT written by the implementer. */
const OWNER = "00000000-0000-4000-8000-000000000004"; // PYME principal (test-support)
const OTHER = "00000000-0000-4000-8000-0000000000ff";
const APP_ID = parseApplicationId("123e4567-e89b-42d3-a456-426614174000");

const REQUEST = {
  smeReference: "SM-1",
  declaredTotalArs: 1000,
  periodStart: "2026-01",
  periodEnd: "2026-06",
  simuladoLabel: "SIMULADO" as const
};

function appDeps(overrides: {
  findByOwner?: MyApplicationRouteDependencies["repository"]["findByOwner"];
  findReviewStateByApplicationId?: MyApplicationRouteDependencies["repository"]["findReviewStateByApplicationId"];
} = {}): MyApplicationRouteDependencies {
  return {
    repository: {
      findByOwner: overrides.findByOwner ?? (async () => ({ ok: true as const, value: [] })),
      findReviewStateByApplicationId:
        overrides.findReviewStateByApplicationId ?? (async () => ({ ok: true as const, value: "human_review" as const }))
    }
  };
}

function docDeps(listByOwner: MyDocumentsRouteDependencies["documents"]["listByOwner"]): MyDocumentsRouteDependencies {
  return { documents: { listByOwner } };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  app = undefined;
});

describe("WU1 verifier: S5 identity is the principal only", () => {
  it("ignores ?userId=, ?owner=, and a spoofed x-owner header on /sme-requests/mine", async () => {
    const findByOwner = vi.fn(async () => ({ ok: true as const, value: [] }));
    app = buildAppAs("PYME", { myApplication: appDeps({ findByOwner }) });

    const res = await app.inject({
      method: "GET",
      url: `/sme-requests/mine?userId=${OTHER}&owner=${OTHER}`,
      headers: { "x-owner-id": OTHER, "x-user-id": OTHER }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ application: null });
    expect(findByOwner).toHaveBeenCalledTimes(1);
    expect(findByOwner).toHaveBeenCalledWith(OWNER);
    expect(findByOwner).not.toHaveBeenCalledWith(OTHER);
  });

  it("ignores a GET body carrying a foreign owner", async () => {
    const findByOwner = vi.fn(async () => ({ ok: true as const, value: [] }));
    app = buildAppAs("PYME", { myApplication: appDeps({ findByOwner }) });

    const res = await app.inject({
      method: "GET",
      url: "/sme-requests/mine",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ ownerUserId: OTHER, userId: OTHER })
    });

    expect([200, 400]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(findByOwner).toHaveBeenCalledWith(OWNER);
    }
    expect(findByOwner).not.toHaveBeenCalledWith(OTHER);
  });

  it("ignores a foreign owner on /pyme-documents/mine", async () => {
    const listByOwner = vi.fn(async () => ({ ok: true as const, value: [] }));
    app = buildAppAs("PYME", { myDocuments: docDeps(listByOwner) });

    const res = await app.inject({
      method: "GET",
      url: `/pyme-documents/mine?ownerUserId=${OTHER}`,
      headers: { "x-owner": OTHER }
    });

    expect(res.statusCode).toBe(200);
    expect(listByOwner).toHaveBeenCalledWith(OWNER);
    expect(listByOwner).not.toHaveBeenCalledWith(OTHER);
  });
});

describe("WU1 verifier: S6 real server state, fresh session", () => {
  it("returns the persisted applicationId + real review state from the repository", async () => {
    const findByOwner = vi.fn(async () => ({
      ok: true as const,
      value: [{ applicationId: APP_ID, request: REQUEST, ownerUserId: OWNER }]
    }));
    const findReviewStateByApplicationId = vi.fn(async () => ({ ok: true as const, value: "approved" as const }));
    app = buildAppAs("PYME", { myApplication: appDeps({ findByOwner, findReviewStateByApplicationId }) });

    const res = await app.inject({ method: "GET", url: "/sme-requests/mine" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ application: { applicationId: APP_ID, state: "approved" } });
    expect(findReviewStateByApplicationId).toHaveBeenCalledWith(APP_ID);
  });

  it("returns { application: null } and never consults review state when the owner has none", async () => {
    const findReviewStateByApplicationId = vi.fn(async () => ({ ok: true as const, value: "approved" as const }));
    app = buildAppAs("PYME", {
      myApplication: appDeps({ findByOwner: async () => ({ ok: true as const, value: [] }), findReviewStateByApplicationId })
    });

    const res = await app.inject({ method: "GET", url: "/sme-requests/mine" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ application: null });
    expect(findReviewStateByApplicationId).not.toHaveBeenCalled();
  });

  it("never invents a state: a failed review read is 503, not a fabricated state", async () => {
    app = buildAppAs("PYME", {
      myApplication: appDeps({
        findByOwner: async () => ({
          ok: true as const,
          value: [{ applicationId: APP_ID, request: REQUEST, ownerUserId: OWNER }]
        }),
        findReviewStateByApplicationId: async () => ({ ok: false as const, error: { code: "not_found" as const } })
      })
    });

    const res = await app.inject({ method: "GET", url: "/sme-requests/mine" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ code: "unavailable" });
  });
});

describe("WU1 verifier: S4 metadata only, no storage path on the wire", () => {
  it("drops objectPath even when the repository row carries it as its own key", async () => {
    const objectPath = `${OWNER}/cuit/secret-file.pdf`;
    app = buildAppAs("PYME", {
      myDocuments: docDeps(async () => ({
        ok: true as const,
        value: [
          {
            documentId: "323e4567-e89b-42d3-a456-426614174000",
            ownerUserId: OWNER,
            kind: "cuit" as const,
            objectPath,
            name: "constancia-cuit.pdf",
            sizeBytes: 20480,
            contentType: "application/pdf",
            createdAt: "2026-10-15T12:00:00.000Z"
          }
        ]
      }))
    });

    const res = await app.inject({ method: "GET", url: "/pyme-documents/mine" });
    expect(res.statusCode).toBe(200);
    const body = res.body;
    expect(body).not.toContain("objectPath");
    expect(body).not.toContain(objectPath);
    expect(body).not.toContain("secret-file.pdf");
    expect(Object.keys(res.json().documents[0]).sort()).toEqual(
      ["documentId", "kind", "name", "sizeBytes", "contentType", "createdAt"].sort()
    );
  });

  it("drops an unknown extra key a repository row might smuggle in", async () => {
    app = buildAppAs("PYME", {
      myDocuments: docDeps(async () => ({
        ok: true as const,
        value: [
          {
            documentId: "323e4567-e89b-42d3-a456-426614174000",
            ownerUserId: OWNER,
            kind: "photo" as const,
            objectPath: `${OWNER}/photo/x.jpg`,
            name: "foto.jpg",
            sizeBytes: 1,
            contentType: "image/jpeg",
            createdAt: "2026-10-15T12:00:00.000Z",
            smuggledOwnerId: OTHER,
            storageUrl: "https://secret.example/x"
          } as never
        ]
      }))
    });

    const res = await app.inject({ method: "GET", url: "/pyme-documents/mine" });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain("smuggledOwnerId");
    expect(res.body).not.toContain("storageUrl");
    expect(res.body).not.toContain("secret.example");
    expect(res.body).not.toContain(OTHER);
  });
});

describe("WU1 verifier: status mapping and no shadowing", () => {
  it("401 without a token, 403 for a non-PyME, on both new routes", async () => {
    app = buildApp({ myApplication: appDeps(), myDocuments: docDeps(async () => ({ ok: true as const, value: [] })) });
    expect((await app.inject({ method: "GET", url: "/sme-requests/mine" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/pyme-documents/mine" })).statusCode).toBe(401);
    await app.close();

    app = buildAppAs("INVERSOR", { myApplication: appDeps(), myDocuments: docDeps(async () => ({ ok: true as const, value: [] })) });
    expect((await app.inject({ method: "GET", url: "/sme-requests/mine" })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/pyme-documents/mine" })).statusCode).toBe(403);
  });

  it("503 { code: unavailable } when the repository read fails on either route", async () => {
    app = buildAppAs("PYME", {
      myApplication: appDeps({ findByOwner: async () => ({ ok: false as const, error: { code: "unavailable" as const } }) }),
      myDocuments: docDeps(async () => ({ ok: false as const, error: { code: "unavailable" as const } }))
    });
    const a = await app.inject({ method: "GET", url: "/sme-requests/mine" });
    const d = await app.inject({ method: "GET", url: "/pyme-documents/mine" });
    expect(a.statusCode).toBe(503);
    expect(a.json()).toEqual({ code: "unavailable" });
    expect(d.statusCode).toBe(503);
    expect(d.json()).toEqual({ code: "unavailable" });
  });

  it("static /mine never shadows GET /sme-requests/:applicationId", async () => {
    const findByApplicationId = vi.fn(async () => ({ ok: false as const, error: { code: "not_found" as const } }));
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
      generateApplicationId: () => APP_ID
    } as unknown as SmeRequestRouteDependencies;

    app = buildAppAs("PYME", { myApplication: appDeps(), smeRequest });

    const mine = await app.inject({ method: "GET", url: "/sme-requests/mine" });
    expect(mine.statusCode).toBe(200);
    expect(findByApplicationId).not.toHaveBeenCalled();

    const byId = await app.inject({ method: "GET", url: `/sme-requests/${APP_ID}` });
    expect(byId.statusCode).toBe(404);
    expect(findByApplicationId).toHaveBeenCalledWith(APP_ID);
  });
});

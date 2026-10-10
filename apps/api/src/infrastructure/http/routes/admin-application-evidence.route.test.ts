import { parseAdminApplicationEvidence, parseApplicationId } from "@vaqcrow/contracts";
import type { AdminApplicationEvidence } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminApplicationEvidencePort } from "../../../application/ports/admin-application-evidence-port.js";
import { buildApp } from "../build-app.js";
import { bearer, fakeAuthPort } from "../test-support/auth.js";
import { createAdminApplicationEvidenceRouteDependencies } from "./admin-application-evidence.route.js";

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const URL = `/application-reviews/${APPLICATION_ID}/evidence`;
const CAMPAIGN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const EXPLORER = "https://stellar.expert/explorer/testnet";

const EVIDENCE: AdminApplicationEvidence = parseAdminApplicationEvidence({
  applicationId: APPLICATION_ID,
  applicationState: "approved",
  smeReference: "sme-001",
  companyName: "Almacén Demo",
  decision: null,
  deployment: { state: "confirmed", campaignId: CAMPAIGN_ID },
  vault: {
    campaignId: CAMPAIGN_ID,
    contractAddress: VAULT,
    vaultExplorerUrl: `${EXPLORER}/contract/${VAULT}`,
    deployTransactionHash: null,
    deployExplorerUrl: null,
    state: "funding",
    goalStroops: "100000000",
    totalStroops: "0",
    deadline: "2026-12-01T00:00:00.000Z"
  },
  contributions: [],
  distributions: [],
  reconciliation: { status: "in_sync", lastReconciledAt: "2026-10-02T12:00:00.000Z", lastDivergedAt: null }
});

const BARE: AdminApplicationEvidence = {
  ...EVIDENCE,
  companyName: null,
  deployment: null,
  vault: null,
  reconciliation: null
};

function appFor(get: AdminApplicationEvidencePort["get"]): FastifyInstance {
  return buildApp({ adminApplicationEvidence: { evidence: { get } }, auth: { port: fakeAuthPort() } });
}

describe("GET /application-reviews/:applicationId/evidence", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it("returns the evidence chain for an ADMIN, as the contract parses it", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, value: EVIDENCE });
    app = appFor(get);

    const response = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(200);
    expect(parseAdminApplicationEvidence(response.json())).toEqual(EVIDENCE);
    expect(get).toHaveBeenCalledExactlyOnceWith(APPLICATION_ID);
  });

  it("answers 200 with nulls for an application without decision or campaign", async () => {
    app = appFor(vi.fn().mockResolvedValue({ ok: true, value: BARE }));

    const response = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(BARE);
  });

  it("answers 401 without a token", async () => {
    const get = vi.fn();
    app = appFor(get);

    const response = await app.inject({ method: "GET", url: URL });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
    expect(get).not.toHaveBeenCalled();
  });

  it.each(["PYME", "INVERSOR"] as const)("rejects %s with 403 before reading any evidence", async (role) => {
    const get = vi.fn();
    app = appFor(get);

    const response = await app.inject({ method: "GET", url: URL, headers: bearer(role) });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
    expect(get).not.toHaveBeenCalled();
  });

  it("maps a malformed application id to 400", async () => {
    const get = vi.fn();
    app = appFor(get);

    const response = await app.inject({
      method: "GET",
      url: "/application-reviews/not-an-id/evidence",
      headers: bearer("ADMIN")
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(get).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "not_found" }, 404],
    [{ code: "unavailable" }, 503]
  ] as const)("sanitizes use-case error %o to exactly { code }", async (error, status) => {
    app = appFor(vi.fn().mockResolvedValue({ ok: false, error }));

    const response = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ code: error.code });
  });

  it("maps a thrown dependency to a sanitized 503 that never echoes the error", async () => {
    app = appFor(vi.fn().mockRejectedValue(new Error("relation does not exist: sensitive")));

    const response = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
    expect(response.body).not.toMatch(/sensitive/);
  });

  it("wires the use case end to end: a PostgREST failure is a bare 503 and null links without an explorer base", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const notFound = vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } });
    const base = {
      applicationReviews: {
        findById: vi.fn().mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, state: "approved" } }),
        readLatestHumanDecision: notFound
      },
      smeRequests: {
        findByApplicationId: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            applicationId: APPLICATION_ID,
            request: {
              smeReference: "sme-001",
              declaredTotalArs: 1,
              periodStart: "2026-01",
              periodEnd: "2026-06",
              simuladoLabel: "SIMULADO"
            }
          }
        })
      },
      businesses: { findByOwner: notFound },
      deployments: { findByApplicationId: notFound },
      campaigns: {
        findByApplicationId: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            campaignId: CAMPAIGN_ID,
            applicationId: APPLICATION_ID,
            smeAccountId: `G${"S".repeat(55)}`,
            contractAddress: VAULT,
            network: "standalone",
            tokenContractAddress: `C${"T".repeat(55)}`,
            goalStroops: 10n,
            deadline: "2026-12-01T00:00:00.000Z",
            state: "open",
            totalStroops: 0n,
            reconciliationStatus: "in_sync",
            lastReconciledAt: "2026-10-02T12:00:00.000Z",
            createdAt: "2026-10-02T12:00:00.000Z",
            updatedAt: "2026-10-02T12:00:00.000Z"
          }
        })
      },
      contributionTransactions: {
        listObservedContributionTransactions: vi.fn().mockResolvedValue({ ok: true, value: [] })
      },
      distributions: { listByCampaign: vi.fn().mockResolvedValue({ ok: true, value: [] }) },
      explorerBaseUrl: undefined
    };

    app = buildApp({
      adminApplicationEvidence: createAdminApplicationEvidenceRouteDependencies(base),
      auth: { port: fakeAuthPort() }
    });
    const local = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });
    expect(local.statusCode).toBe(200);
    expect(local.json().vault).toMatchObject({ vaultExplorerUrl: null, deployExplorerUrl: null, state: "funding" });
    expect(() => parseAdminApplicationEvidence(local.json())).not.toThrow();
    await app.close();

    app = buildApp({
      adminApplicationEvidence: createAdminApplicationEvidenceRouteDependencies({
        ...base,
        distributions: { listByCampaign: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) }
      }),
      auth: { port: fakeAuthPort() }
    });
    const failed = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });
    expect(failed.statusCode).toBe(503);
    expect(failed.json()).toEqual({ code: "unavailable" });
    consoleError.mockRestore();
  });
});

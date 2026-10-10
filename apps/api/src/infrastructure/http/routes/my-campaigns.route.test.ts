import { afterEach, describe, expect, it, vi } from "vitest";
import type { MyCampaignsRepositoryPort } from "../../../application/ports/my-campaigns-repository-port.js";
import { buildAppAs, principalFor } from "../test-support/auth.js";
import { buildApp } from "../build-app.js";
import type { MyCampaignsRouteDependencies } from "./my-campaigns.route.js";

/**
 * `GET /my-campaigns` (#434, WU1).
 *
 * The route is `PYME`-only and always scopes to `request.principal.userId`; a
 * query- or body-supplied owner is ignored. A repository failure is a
 * sanitized `503`, never a 200 with an empty but misleading dashboard.
 */
const USER_ID = principalFor("PYME").userId;
const OTHER = "00000000-0000-4000-8000-000000000009";
const EXPLORER = "https://stellar.expert/explorer/testnet";
const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const HASH = "d".repeat(64);

const CAMPAIGN = {
  campaignId: CAMPAIGN_ID,
  name: "Panadería Sol",
  sector: "Alimentos",
  city: "CABA",
  goalArs: 5_000_000n,
  totalStroops: 1_250_000n,
  goalStroops: 10_000_000n,
  state: "open" as const,
  closeDate: "2026-12-01T00:00:00.000Z",
  vaultAddress: VAULT,
  hasImage: false,
  contributorsCount: 2
};

function deps(overrides: {
  readonly campaigns?: MyCampaignsRepositoryPort["listCampaigns"];
  readonly distributions?: MyCampaignsRepositoryPort["listDistributions"];
  readonly explorerBaseUrl?: string | undefined;
} = {}): MyCampaignsRouteDependencies {
  return {
    myCampaigns: {
      listCampaigns: overrides.campaigns ?? (async () => ({ ok: true as const, value: [] })),
      listDistributions: overrides.distributions ?? (async () => ({ ok: true as const, value: [] })),
      listSales: async () => ({ ok: true as const, value: [] })
    },
    now: () => new Date("2026-10-09T00:00:00.000Z"),
    explorerBaseUrl: "explorerBaseUrl" in overrides ? overrides.explorerBaseUrl : EXPLORER
  };
}

let app: ReturnType<typeof buildAppAs> | ReturnType<typeof buildApp> | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /my-campaigns", () => {
  it("returns the signed-in PyME's campaigns", async () => {
    app = buildAppAs("PYME", {
      myCampaigns: deps({
        campaigns: async () => ({
          ok: true as const,
          value: [
            {
              campaignId: "123e4567-e89b-42d3-a456-426614174000",
              name: "Panadería Sol",
              sector: "Alimentos",
              city: "CABA",
              goalArs: 5_000_000n,
              totalStroops: 1_250_000n,
              goalStroops: 10_000_000n,
              state: "open",
              closeDate: "2026-12-01T00:00:00.000Z",
              vaultAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
              hasImage: false,
              contributorsCount: 2
            }
          ]
        })
      })
    });

    const response = await app.inject({ method: "GET", url: "/my-campaigns" });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { campaigns: unknown[] };
    expect(body.campaigns).toHaveLength(1);
    expect((body.campaigns[0] as { name: string }).name).toBe("Panadería Sol");
  });

  it("ignores a query-supplied owner and uses the verified principal", async () => {
    const listCampaigns = vi.fn(async () => ({ ok: true as const, value: [] }));
    app = buildAppAs("PYME", { myCampaigns: { ...deps(), myCampaigns: { ...deps().myCampaigns, listCampaigns } } });

    const response = await app.inject({ method: "GET", url: `/my-campaigns?owner=${OTHER}` });

    expect(response.statusCode).toBe(200);
    expect(listCampaigns).toHaveBeenCalledWith(USER_ID);
  });

  it("returns an empty dashboard for a PyME with no campaigns", async () => {
    app = buildAppAs("PYME", { myCampaigns: deps() });

    const response = await app.inject({ method: "GET", url: "/my-campaigns" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ campaigns: [] });
  });

  it("answers a sanitized 503 when the read fails", async () => {
    app = buildAppAs("PYME", {
      myCampaigns: deps({ campaigns: async () => ({ ok: false as const, error: { code: "unavailable" as const } }) })
    });

    const response = await app.inject({ method: "GET", url: "/my-campaigns" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("answers 401 without a token (default-deny)", async () => {
    app = buildApp({ myCampaigns: deps() });

    const response = await app.inject({ method: "GET", url: "/my-campaigns" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
  });

  it.each(["INVERSOR", "ADMIN"] as const)("rejects %s before the handler runs", async (role) => {
    const listCampaigns = vi.fn(async () => ({ ok: true as const, value: [] }));
    app = buildAppAs(role, { myCampaigns: { ...deps(), myCampaigns: { ...deps().myCampaigns, listCampaigns } } });

    const response = await app.inject({ method: "GET", url: "/my-campaigns" });

    expect(response.statusCode).toBe(403);
    expect(listCampaigns).not.toHaveBeenCalled();
  });
});

describe("GET /my-campaigns Testnet transparency (#438/WU3)", () => {
  const distributions: MyCampaignsRepositoryPort["listDistributions"] = async () => ({
    ok: true as const,
    value: [
      { campaignId: CAMPAIGN_ID, distributionId: "323e4567-e89b-42d3-a456-426614174000", period: "2026-06", amountStroops: 1n, state: "confirmed" as const, transactionHash: HASH }
    ]
  });

  it("serves the vault link and each distribution's hash and link from the configured base", async () => {
    app = buildAppAs("PYME", {
      myCampaigns: deps({ campaigns: async () => ({ ok: true as const, value: [CAMPAIGN] }), distributions })
    });

    const response = await app.inject({ method: "GET", url: "/my-campaigns" });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      campaigns: Array<{ vaultExplorerUrl: string | null; distributions: Array<{ transactionHash: string; explorerUrl: string | null }> }>;
    };
    expect(body.campaigns[0]?.vaultExplorerUrl).toBe(`${EXPLORER}/contract/${VAULT}`);
    expect(body.campaigns[0]?.distributions[0]).toMatchObject({ transactionHash: HASH, explorerUrl: `${EXPLORER}/tx/${HASH}` });
  });

  it("serves null links when no explorer base is configured", async () => {
    app = buildAppAs("PYME", {
      myCampaigns: deps({
        explorerBaseUrl: undefined,
        campaigns: async () => ({ ok: true as const, value: [CAMPAIGN] }),
        distributions
      })
    });

    const response = await app.inject({ method: "GET", url: "/my-campaigns" });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      campaigns: Array<{ vaultExplorerUrl: string | null; distributions: Array<{ transactionHash: string; explorerUrl: string | null }> }>;
    };
    expect(body.campaigns[0]?.vaultExplorerUrl).toBeNull();
    expect(body.campaigns[0]?.distributions[0]).toMatchObject({ transactionHash: HASH, explorerUrl: null });
  });
});

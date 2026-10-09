import { afterEach, describe, expect, it, vi } from "vitest";
import type { PortfolioRepositoryPort } from "../../../application/ports/portfolio-repository-port.js";
import type { WalletRepositoryPort } from "../../../application/ports/wallet-repository-port.js";
import { buildAppAs, principalFor } from "../test-support/auth.js";
import type { PortfolioRouteDependencies } from "./portfolio.route.js";

/**
 * `GET /portfolio` (#426, WU1).
 *
 * The route is `INVERSOR`-only and always scopes to `request.principal.userId`;
 * a query- or body-supplied investor is ignored. A repository or key failure is
 * a sanitized `503`, never a 200.
 */
const USER_ID = principalFor("INVERSOR").userId;
const ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER = "GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function deps(overrides: {
  readonly key?: string | null;
  readonly keyOk?: boolean;
  readonly positions?: PortfolioRepositoryPort["listPositions"];
  readonly distributions?: PortfolioRepositoryPort["listDistributions"];
} = {}): PortfolioRouteDependencies {
  const wallets: Pick<WalletRepositoryPort, "readPublicKey"> = {
    readPublicKey: async () =>
      overrides.keyOk === false
        ? { ok: false as const, error: { code: "unavailable" } }
        : { ok: true as const, value: overrides.key ?? ACCOUNT }
  };
  return {
    wallets,
    portfolio: {
      listPositions:
        overrides.positions ??
        (async () => ({ ok: true as const, value: [] })),
      listDistributions:
        overrides.distributions ??
        (async () => ({ ok: true as const, value: [] }))
    },
    now: () => new Date("2026-10-09T00:00:00.000Z")
  };
}

let app: ReturnType<typeof buildAppAs> | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /portfolio", () => {
  it("returns the signed-in investor's portfolio", async () => {
    app = buildAppAs("INVERSOR", {
      portfolio: deps({
        positions: async () => ({
          ok: true as const,
          value: [
            {
              campaignId: CAMPAIGN_ID,
              name: "Panadería Sol",
              sector: "Alimentos",
              city: "CABA",
              contributionStroops: 1_500_000n,
              goalArs: 5_000_000n,
              totalStroops: 2_500_000n,
              goalStroops: 10_000_000n,
              state: "open",
              closeDate: "2026-12-01T00:00:00.000Z",
              vaultAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
              hasImage: false
            }
          ]
        })
      })
    });

    const response = await app.inject({ method: "GET", url: "/portfolio" });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { contributions: unknown[]; totals: { totalContributedXlm: string } };
    expect(body.contributions).toHaveLength(1);
    expect(body.totals.totalContributedXlm).toBe("0.1500000");
  });

  it("ignores a query-supplied investor and uses the verified principal's key", async () => {
    const readPublicKey = vi.fn(async () => ({ ok: true as const, value: ACCOUNT }));
    const listPositions = vi.fn(async () => ({ ok: true as const, value: [] }));
    app = buildAppAs("INVERSOR", {
      portfolio: { ...deps(), wallets: { readPublicKey }, portfolio: { listPositions, listDistributions: async () => ({ ok: true as const, value: [] }) } }
    });

    const response = await app.inject({ method: "GET", url: `/portfolio?investor=${OTHER}` });

    expect(response.statusCode).toBe(200);
    expect(readPublicKey).toHaveBeenCalledWith(USER_ID);
    expect(listPositions).toHaveBeenCalledWith(ACCOUNT);
  });

  it("returns an empty portfolio when the investor has no stored wallet key", async () => {
    app = buildAppAs("INVERSOR", { portfolio: deps({ key: null }) });

    const response = await app.inject({ method: "GET", url: "/portfolio" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      contributions: [],
      distributions: [],
      totals: { totalContributedXlm: "0.0000000", totalDistributionsXlm: null, campaignCount: 0 }
    });
  });

  it("answers a sanitized 503 when the read fails", async () => {
    app = buildAppAs("INVERSOR", { portfolio: deps({ keyOk: false }) });

    const response = await app.inject({ method: "GET", url: "/portfolio" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it.each(["PYME", "ADMIN"] as const)("rejects %s before the handler runs", async (role) => {
    const readPublicKey = vi.fn(async () => ({ ok: true as const, value: ACCOUNT }));
    app = buildAppAs(role, {
      portfolio: { ...deps(), wallets: { readPublicKey } }
    });

    const response = await app.inject({ method: "GET", url: "/portfolio" });

    expect(response.statusCode).toBe(403);
    expect(readPublicKey).not.toHaveBeenCalled();
  });
});

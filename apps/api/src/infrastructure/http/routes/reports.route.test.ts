import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReportsRepositoryPort } from "../../../application/ports/reports-repository-port.js";
import type { WalletRepositoryPort } from "../../../application/ports/wallet-repository-port.js";
import { buildAppAs, principalFor } from "../test-support/auth.js";
import type { ReportsRouteDependencies } from "./reports.route.js";

/**
 * `GET /reports` and `GET /reports/sales-by-pyme` (#430, WU1).
 *
 * Both routes are available to every authenticated role and always scope to
 * `request.principal.userId`; a query-supplied account is ignored. A malformed
 * `from`/`to` is a `400 { code: "invalid_request" }`; a key or repository
 * failure is a sanitized `503`, never a 200 with misleading data.
 */
const USER_ID = principalFor("INVERSOR").userId;
const ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const OTHER = "GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const EXPLORER = "https://stellar.expert/explorer/testnet";
const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const OWN_HASH = "a".repeat(64);
const OWN_TRANSACTION = {
  transactionHash: OWN_HASH,
  campaignId: "123e4567-e89b-42d3-a456-426614174000",
  campaignName: "Panadería Sol",
  vaultAddress: VAULT,
  amountStroops: 1_500_000n,
  observedAt: "2026-03-15T00:00:00+00:00"
};

function deps(overrides: {
  readonly key?: string | null;
  readonly keyOk?: boolean;
  readonly contributions?: ReportsRepositoryPort["listContributions"];
  readonly distributions?: ReportsRepositoryPort["listDistributions"];
  readonly sales?: ReportsRepositoryPort["listSalesByPyme"];
  readonly transactions?: ReportsRepositoryPort["listContributionTransactions"];
  readonly explorerBaseUrl?: string | undefined;
} = {}): ReportsRouteDependencies {
  const wallets: Pick<WalletRepositoryPort, "readPublicKey"> = {
    readPublicKey: async () =>
      overrides.keyOk === false
        ? { ok: false as const, error: { code: "unavailable" } }
        : { ok: true as const, value: overrides.key ?? ACCOUNT }
  };
  return {
    wallets,
    reports: {
      listContributions: overrides.contributions ?? (async () => ({ ok: true as const, value: [] })),
      listDistributions: overrides.distributions ?? (async () => ({ ok: true as const, value: [] })),
      listSalesByPyme: overrides.sales ?? (async () => ({ ok: true as const, value: [] })),
      listContributionTransactions: overrides.transactions ?? (async () => ({ ok: true as const, value: [] }))
    },
    now: () => new Date("2026-10-09T00:00:00.000Z"),
    explorerBaseUrl: "explorerBaseUrl" in overrides ? overrides.explorerBaseUrl : EXPLORER
  };
}

let app: ReturnType<typeof buildAppAs> | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /reports", () => {
  it("returns the signed-in investor's report", async () => {
    app = buildAppAs("INVERSOR", {
      reports: deps({
        contributions: async () => ({
          ok: true as const,
          value: [{ campaignId: "123e4567-e89b-42d3-a456-426614174000", contributionStroops: 1_500_000n, observedAt: "2026-03-01T00:00:00+00:00" }]
        })
      })
    });

    const response = await app.inject({ method: "GET", url: "/reports?from=2026-01&to=2026-06" });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { kpis: { contributedXlm: string }; range: unknown };
    expect(body.kpis.contributedXlm).toBe("0.1500000");
    expect(body.range).toEqual({ from: "2026-01", to: "2026-06" });
  });

  it.each(["PYME", "INVERSOR", "ADMIN"] as const)("is available to %s", async (role) => {
    app = buildAppAs(role, { reports: deps() });

    const response = await app.inject({ method: "GET", url: "/reports" });

    expect(response.statusCode).toBe(200);
  });

  it("ignores a query-supplied account and uses the verified principal's key", async () => {
    const readPublicKey = vi.fn(async () => ({ ok: true as const, value: ACCOUNT }));
    const listContributions = vi.fn(async () => ({ ok: true as const, value: [] }));
    app = buildAppAs("INVERSOR", {
      reports: { ...deps(), wallets: { readPublicKey }, reports: { ...deps().reports, listContributions } }
    });

    const response = await app.inject({ method: "GET", url: `/reports?investor=${OTHER}` });

    expect(response.statusCode).toBe(200);
    expect(readPublicKey).toHaveBeenCalledWith(USER_ID);
    expect(listContributions).toHaveBeenCalledWith(ACCOUNT);
  });

  it("returns an empty report when the principal has no stored wallet key", async () => {
    app = buildAppAs("INVERSOR", { reports: deps({ key: null }) });

    const response = await app.inject({ method: "GET", url: "/reports" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      isEmpty: true,
      availableRange: { firstPeriod: null, lastPeriod: null },
      kpis: { contributedXlm: "0.0000000", pendingDistributionsXlm: null, campaignsCount: 0 }
    });
  });

  it("answers 400 for a malformed or one-sided range", async () => {
    app = buildAppAs("INVERSOR", { reports: deps() });

    for (const query of ["from=2026-13&to=2026-13", "from=2026-06&to=2026-01", "from=2026-01", "to=2026-01", "from=jan&to=2026-01"]) {
      const response = await app.inject({ method: "GET", url: `/reports?${query}` });
      expect(response.statusCode, query).toBe(400);
      expect(response.json()).toEqual({ code: "invalid_request" });
    }
  });

  it("answers 401 without a valid token", async () => {
    app = buildAppAs("INVERSOR", { reports: deps() });

    const response = await app.inject({ method: "GET", url: "/reports", headers: { authorization: "Basic abc" } });

    expect(response.statusCode).toBe(401);
  });

  it("answers a sanitized 503 when the read fails", async () => {
    app = buildAppAs("INVERSOR", { reports: deps({ keyOk: false }) });

    const response = await app.inject({ method: "GET", url: "/reports" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

describe("GET /reports/sales-by-pyme", () => {
  it("returns the sales block for the signed-in investor", async () => {
    app = buildAppAs("INVERSOR", {
      reports: deps({
        sales: async () => ({
          ok: true as const,
          value: [
            { campaignId: "123e4567-e89b-42d3-a456-426614174000", name: "Panadería Sol", sector: "Alimentos", period: "2026-06", salesArs: 9_000_000n, status: "reported" }
          ]
        })
      })
    });

    const response = await app.inject({ method: "GET", url: "/reports/sales-by-pyme?from=2026-01&to=2026-06" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      pymes: [
        {
          name: "Panadería Sol",
          sector: "Alimentos",
          imageUrl: "/marketplace/campaigns/123e4567-e89b-42d3-a456-426614174000/image",
          period: "2026-06",
          salesArs: 9_000_000,
          status: "reported"
        }
      ]
    });
  });

  it("answers 400 for an invalid range and 503 when the read fails", async () => {
    app = buildAppAs("INVERSOR", { reports: deps() });
    expect((await app.inject({ method: "GET", url: "/reports/sales-by-pyme?from=2026-06&to=2026-01" })).statusCode).toBe(400);
    await app.close();

    app = buildAppAs("INVERSOR", { reports: deps({ keyOk: false }) });
    const failing = await app.inject({ method: "GET", url: "/reports/sales-by-pyme" });
    expect(failing.statusCode).toBe(503);
    expect(failing.json()).toEqual({ code: "unavailable" });
  });
});

describe("GET /reports Testnet transparency (#438/WU3)", () => {
  it("serves distribution and contribution hashes with explorer links from the configured base", async () => {
    app = buildAppAs("INVERSOR", {
      reports: deps({
        distributions: async () => ({
          ok: true as const,
          value: [
            {
              distributionId: "d1000000-0000-4000-8000-000000000001",
              campaignId: "123e4567-e89b-42d3-a456-426614174000",
              campaignName: "Panadería Sol",
              period: "2026-06",
              amountStroops: 1n,
              state: "confirmed" as const,
              confirmedAt: "2026-07-01T00:00:00+00:00",
              recordedAt: "2026-06-30T00:00:00+00:00",
              declaredSalesArs: null,
              transactionHash: "d".repeat(64)
            }
          ]
        }),
        transactions: async () => ({ ok: true as const, value: [OWN_TRANSACTION] })
      })
    });

    const response = await app.inject({ method: "GET", url: "/reports?from=2026-01&to=2026-06" });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      latestDistributions: Array<{ transactionHash: string; explorerUrl: string | null }>;
      contributionTransactions: Array<Record<string, unknown>>;
    };
    expect(body.latestDistributions[0]).toMatchObject({
      transactionHash: "d".repeat(64),
      explorerUrl: `${EXPLORER}/tx/${"d".repeat(64)}`
    });
    expect(body.contributionTransactions).toEqual([
      {
        date: "2026-03-15T00:00:00+00:00",
        pyme: "Panadería Sol",
        amountXlm: "0.1500000",
        transactionHash: OWN_HASH,
        explorerUrl: `${EXPLORER}/tx/${OWN_HASH}`,
        vaultAddress: VAULT,
        vaultExplorerUrl: `${EXPLORER}/contract/${VAULT}`
      }
    ]);
  });

  it("serves null links when no explorer base is configured and respects the range", async () => {
    app = buildAppAs("INVERSOR", {
      reports: deps({ explorerBaseUrl: undefined, transactions: async () => ({ ok: true as const, value: [OWN_TRANSACTION] }) })
    });

    const inRange = await app.inject({ method: "GET", url: "/reports?from=2026-03&to=2026-03" });
    const outOfRange = await app.inject({ method: "GET", url: "/reports?from=2026-04&to=2026-06" });

    expect(inRange.statusCode).toBe(200);
    expect((inRange.json() as { contributionTransactions: unknown[] }).contributionTransactions).toEqual([
      expect.objectContaining({ transactionHash: OWN_HASH, explorerUrl: null, vaultExplorerUrl: null })
    ]);
    expect((outOfRange.json() as { contributionTransactions: unknown[] }).contributionTransactions).toEqual([]);
  });

  it("reads contribution hashes only for the principal's own account, never a query-supplied one", async () => {
    const listContributionTransactions = vi.fn(async (account: string) => ({
      ok: true as const,
      value: account === ACCOUNT ? [OWN_TRANSACTION] : [{ ...OWN_TRANSACTION, transactionHash: "b".repeat(64) }]
    }));
    app = buildAppAs("INVERSOR", { reports: { ...deps(), reports: { ...deps().reports, listContributionTransactions } } });

    const response = await app.inject({ method: "GET", url: `/reports?from=2026-01&to=2026-06&account=${OTHER}` });

    expect(response.statusCode).toBe(200);
    expect(listContributionTransactions).toHaveBeenCalledTimes(1);
    expect(listContributionTransactions).toHaveBeenCalledWith(ACCOUNT);
    expect(response.body).toContain(OWN_HASH);
    expect(response.body).not.toContain("b".repeat(64));
  });

  it("answers a sanitized 503 when the contribute transaction read fails", async () => {
    app = buildAppAs("INVERSOR", {
      reports: deps({ transactions: async () => ({ ok: false as const, error: { code: "unavailable" as const } }) })
    });

    const response = await app.inject({ method: "GET", url: "/reports" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

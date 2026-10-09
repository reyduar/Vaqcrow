import { describe, expect, it, vi } from "vitest";
import type {
  ReportContributionRecord,
  ReportDistributionRecord,
  ReportSalesByPymeRecord,
  ReportsRepositoryPort
} from "../ports/reports-repository-port.js";
import type { WalletRepositoryPort } from "../ports/wallet-repository-port.js";
import { getInvestorReport, getInvestorReportSalesByPyme } from "./get-investor-report.js";

/**
 * The investor report use cases (#430, WU1).
 *
 * The Stellar account is resolved server-side from the verified principal's
 * profile; no caller-supplied account is read. Money stays integer/bigint until
 * the final canonical XLM string, the range is month-based (`YYYY-MM`), and
 * aggregation is deterministic over persisted rows. A malformed range is
 * `invalid_request` (a 400 at the route); a key or repository failure is
 * `unavailable` (a 503).
 */
const USER_ID = "00000000-0000-4000-8000-000000000001";
const ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const C1 = "123e4567-e89b-42d3-a456-426614174000";
const C2 = "223e4567-e89b-42d3-a456-426614174000";

const NOW = () => new Date("2026-10-09T00:00:00.000Z");

const CONTRIBUTIONS: readonly ReportContributionRecord[] = [
  { campaignId: C1, contributionStroops: 1_500_000n, observedAt: "2026-03-01T00:00:00+00:00" },
  { campaignId: C2, contributionStroops: 3_000_000n, observedAt: "2026-05-01T00:00:00+00:00" },
  { campaignId: C1, contributionStroops: 2_000_000n, observedAt: "2025-12-01T00:00:00+00:00" }
];

const DISTRIBUTIONS: readonly ReportDistributionRecord[] = [
  {
    distributionId: "d1000000-0000-4000-8000-000000000001",
    campaignId: C1,
    campaignName: "Panadería Sol",
    period: "2026-06",
    amountStroops: 12_500_000n,
    state: "confirmed",
    confirmedAt: "2026-07-01T00:00:00+00:00",
    recordedAt: "2026-06-30T00:00:00+00:00",
    declaredSalesArs: 9_000_000n
  },
  {
    distributionId: "d2000000-0000-4000-8000-000000000002",
    campaignId: C1,
    campaignName: null,
    period: "2026-05",
    amountStroops: 4_000_000n,
    state: "submitted",
    confirmedAt: null,
    recordedAt: "2026-05-10T00:00:00+00:00",
    declaredSalesArs: null
  },
  {
    distributionId: "d3000000-0000-4000-8000-000000000003",
    campaignId: C2,
    campaignName: "Panadería Norte",
    period: "2026-04",
    amountStroops: 1_000_000n,
    state: "failed",
    confirmedAt: null,
    recordedAt: "2026-04-01T00:00:00+00:00",
    declaredSalesArs: null
  },
  {
    distributionId: "d4000000-0000-4000-8000-000000000004",
    campaignId: null,
    campaignName: null,
    period: null,
    amountStroops: 7_000_000n,
    state: "confirmed",
    confirmedAt: "2026-02-01T00:00:00+00:00",
    recordedAt: "2026-02-01T00:00:00+00:00",
    declaredSalesArs: null
  },
  {
    distributionId: "d5000000-0000-4000-8000-000000000005",
    campaignId: C1,
    campaignName: "Panadería Sol",
    period: "2025-11",
    amountStroops: 99_000_000n,
    state: "confirmed",
    confirmedAt: "2025-12-01T00:00:00+00:00",
    recordedAt: "2025-11-30T00:00:00+00:00",
    declaredSalesArs: null
  }
];

function fakeWallet(value: string | null, ok = true): Pick<WalletRepositoryPort, "readPublicKey"> {
  return {
    readPublicKey: async () => (ok ? { ok: true as const, value } : { ok: false as const, error: { code: "unavailable" } })
  };
}

function fakeReports(overrides: Partial<ReportsRepositoryPort> = {}): ReportsRepositoryPort {
  return {
    listContributions: async () => ({ ok: true as const, value: CONTRIBUTIONS }),
    listDistributions: async () => ({ ok: true as const, value: DISTRIBUTIONS }),
    listSalesByPyme: async () => ({ ok: true as const, value: [] }),
    ...overrides
  };
}

describe("getInvestorReport", () => {
  it("returns an empty report without touching the repository when no wallet key is stored", async () => {
    const listContributions = vi.fn();
    const listDistributions = vi.fn();
    const result = await getInvestorReport(
      {
        wallets: fakeWallet(null),
        reports: fakeReports({ listContributions, listDistributions }),
        now: NOW
      },
      { userId: USER_ID }
    );

    expect(result).toEqual({
      ok: true,
      value: {
        range: { from: "2026-05", to: "2026-10" },
        availableRange: { firstPeriod: null, lastPeriod: null },
        isEmpty: true,
        kpis: {
          contributedXlm: "0.0000000",
          confirmedDistributionsXlm: "0.0000000",
          pendingDistributionsCount: 0,
          pendingDistributionsXlm: null,
          campaignsCount: 0
        },
        monthlySeries: [],
        latestDistributions: []
      }
    });
    expect(listContributions).not.toHaveBeenCalled();
    expect(listDistributions).not.toHaveBeenCalled();
  });

  it("scopes both reads by the resolved account key, never a caller-supplied one", async () => {
    const listContributions = vi.fn(async () => ({ ok: true as const, value: [] }));
    const listDistributions = vi.fn(async () => ({ ok: true as const, value: [] }));

    await getInvestorReport(
      { wallets: fakeWallet(ACCOUNT), reports: fakeReports({ listContributions, listDistributions }), now: NOW },
      { userId: USER_ID }
    );

    expect(listContributions).toHaveBeenCalledWith(ACCOUNT);
    expect(listDistributions).toHaveBeenCalledWith(ACCOUNT);
  });

  it("aggregates the in-range KPIs, monthly series and latest distributions", async () => {
    const result = await getInvestorReport(
      { wallets: fakeWallet(ACCOUNT), reports: fakeReports(), now: NOW },
      { userId: USER_ID, from: "2026-01", to: "2026-06" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.range).toEqual({ from: "2026-01", to: "2026-06" });
    expect(result.value.availableRange).toEqual({ firstPeriod: "2025-11", lastPeriod: "2026-06" });
    expect(result.value.isEmpty).toBe(false);
    expect(result.value.kpis).toEqual({
      contributedXlm: "0.4500000",
      confirmedDistributionsXlm: "1.2500000",
      pendingDistributionsCount: 1,
      pendingDistributionsXlm: "0.4000000",
      campaignsCount: 2
    });
    expect(result.value.monthlySeries).toEqual([
      { period: "2026-01", amountXlm: null, state: "none" },
      { period: "2026-02", amountXlm: null, state: "none" },
      { period: "2026-03", amountXlm: null, state: "none" },
      { period: "2026-04", amountXlm: null, state: "none" },
      { period: "2026-05", amountXlm: "0.4000000", state: "pending" },
      { period: "2026-06", amountXlm: "1.2500000", state: "confirmed" }
    ]);
    expect(result.value.latestDistributions).toEqual([
      { date: "2026-07-01T00:00:00+00:00", pyme: "Panadería Sol", declaredSalesArs: 9_000_000, shareXlm: "1.2500000", state: "confirmed" },
      { date: "2026-05-10T00:00:00+00:00", pyme: "PyME", declaredSalesArs: null, shareXlm: "0.4000000", state: "submitted" },
      { date: "2026-04-01T00:00:00+00:00", pyme: "Panadería Norte", declaredSalesArs: null, shareXlm: "0.1000000", state: "failed" }
    ]);
  });

  it("defaults to the last six months ending at the data's latest period", async () => {
    const contributions: readonly ReportContributionRecord[] = [
      { campaignId: C1, contributionStroops: 1_000_000n, observedAt: "2026-02-15T00:00:00+00:00" }
    ];
    const distributions: readonly ReportDistributionRecord[] = [
      { ...DISTRIBUTIONS[0]!, distributionId: "d6000000-0000-4000-8000-000000000006", period: "2026-08" }
    ];
    const result = await getInvestorReport(
      {
        wallets: fakeWallet(ACCOUNT),
        reports: fakeReports({
          listContributions: async () => ({ ok: true as const, value: contributions }),
          listDistributions: async () => ({ ok: true as const, value: distributions })
        }),
        now: NOW
      },
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.range).toEqual({ from: "2026-03", to: "2026-08" });
    expect(result.value.availableRange).toEqual({ firstPeriod: "2026-02", lastPeriod: "2026-08" });
    expect(result.value.monthlySeries).toHaveLength(6);
    expect(result.value.monthlySeries[0]?.period).toBe("2026-03");
    expect(result.value.monthlySeries[5]?.period).toBe("2026-08");
  });

  it("keeps at most five latest distributions, newest first, and skips legacy null periods", async () => {
    const many: readonly ReportDistributionRecord[] = Array.from({ length: 7 }, (_, index) => ({
      distributionId: `d7000000-0000-4000-8000-00000000000${index}`,
      campaignId: C1,
      campaignName: `PyME ${index}`,
      period: `2026-0${index + 1}`,
      amountStroops: BigInt(index + 1) * 1_000_000n,
      state: "confirmed" as const,
      confirmedAt: `2026-0${index + 2}-01T00:00:00+00:00`,
      recordedAt: `2026-0${index + 2}-01T00:00:00+00:00`,
      declaredSalesArs: null
    }));
    const result = await getInvestorReport(
      {
        wallets: fakeWallet(ACCOUNT),
        reports: fakeReports({
          listContributions: async () => ({ ok: true as const, value: [] }),
          listDistributions: async () => ({ ok: true as const, value: [...many, DISTRIBUTIONS[3]!] })
        }),
        now: NOW
      },
      { userId: USER_ID, from: "2026-01", to: "2026-08" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.latestDistributions).toHaveLength(5);
    expect(result.value.latestDistributions.map((row) => row.date)).toEqual([
      "2026-08-01T00:00:00+00:00",
      "2026-07-01T00:00:00+00:00",
      "2026-06-01T00:00:00+00:00",
      "2026-05-01T00:00:00+00:00",
      "2026-04-01T00:00:00+00:00"
    ]);
  });

  it("reports only confirmed distributions as confirmed and keeps pending null when none is pending", async () => {
    const result = await getInvestorReport(
      {
        wallets: fakeWallet(ACCOUNT),
        reports: fakeReports({
          listContributions: async () => ({ ok: true as const, value: [] }),
          listDistributions: async () => ({
            ok: true as const,
            value: [{ ...DISTRIBUTIONS[0]!, period: "2026-03" }]
          })
        }),
        now: NOW
      },
      { userId: USER_ID, from: "2026-01", to: "2026-06" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kpis.confirmedDistributionsXlm).toBe("1.2500000");
    expect(result.value.kpis.pendingDistributionsCount).toBe(0);
    expect(result.value.kpis.pendingDistributionsXlm).toBeNull();
    expect(result.value.kpis.contributedXlm).toBe("0.0000000");
    expect(result.value.kpis.campaignsCount).toBe(0);
  });

  it("rejects a malformed or inverted range before reading the repository", async () => {
    const listContributions = vi.fn(async () => ({ ok: true as const, value: [] }));
    const invalid = [
      { from: "2026-06", to: "2026-01" },
      { from: "2026-13", to: "2026-13" },
      { from: "2026-01" },
      { to: "2026-01" },
      { from: "not-a-period", to: "2026-01" }
    ] as const;

    for (const input of invalid) {
      const result = await getInvestorReport(
        { wallets: fakeWallet(ACCOUNT), reports: fakeReports({ listContributions }), now: NOW },
        { userId: USER_ID, ...input }
      );
      expect(result).toEqual({ ok: false, error: { code: "invalid_request" } });
    }
    expect(listContributions).not.toHaveBeenCalled();
  });

  it("reports unavailable when the wallet key cannot be resolved", async () => {
    const result = await getInvestorReport(
      { wallets: fakeWallet(null, false), reports: fakeReports(), now: NOW },
      { userId: USER_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("reports unavailable when either read fails, never a partial report", async () => {
    const failing = await getInvestorReport(
      {
        wallets: fakeWallet(ACCOUNT),
        reports: fakeReports({ listDistributions: async () => ({ ok: false as const, error: { code: "unavailable" } }) }),
        now: NOW
      },
      { userId: USER_ID }
    );

    expect(failing).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

describe("getInvestorReportSalesByPyme", () => {
  const SALES: readonly ReportSalesByPymeRecord[] = [
    { campaignId: C1, name: "Panadería Sol", sector: "Alimentos", period: "2026-06", salesArs: 9_000_000n, status: "reported" },
    { campaignId: C1, name: "Panadería Sol", sector: "Alimentos", period: "2026-07", salesArs: null, status: "missing" },
    { campaignId: C2, name: "Panadería Norte", sector: "Textil", period: "2026-06", salesArs: 5_000_000n, status: "anomalous" },
    { campaignId: C1, name: "Panadería Sol", sector: "Alimentos", period: "2025-12", salesArs: 1_000_000n, status: "reported" }
  ];

  it("returns an empty block without a repository read when no wallet key is stored", async () => {
    const listSalesByPyme = vi.fn();
    const result = await getInvestorReportSalesByPyme(
      { wallets: fakeWallet(null), reports: fakeReports({ listSalesByPyme }), now: NOW },
      { userId: USER_ID }
    );

    expect(result).toEqual({ ok: true, value: { pymes: [] } });
    expect(listSalesByPyme).not.toHaveBeenCalled();
  });

  it("maps the in-range declared sales with the API-relative image and sorts by name then period", async () => {
    const result = await getInvestorReportSalesByPyme(
      {
        wallets: fakeWallet(ACCOUNT),
        reports: fakeReports({ listSalesByPyme: async () => ({ ok: true as const, value: SALES }) }),
        now: NOW
      },
      { userId: USER_ID, from: "2026-01", to: "2026-06" }
    );

    expect(result).toEqual({
      ok: true,
      value: {
        pymes: [
          {
            name: "Panadería Norte",
            sector: "Textil",
            imageUrl: `/marketplace/campaigns/${C2}/image`,
            period: "2026-06",
            salesArs: 5_000_000,
            status: "anomalous"
          },
          {
            name: "Panadería Sol",
            sector: "Alimentos",
            imageUrl: `/marketplace/campaigns/${C1}/image`,
            period: "2026-06",
            salesArs: 9_000_000,
            status: "reported"
          }
        ]
      }
    });
  });

  it("defaults to the last six months ending at the latest declared period", async () => {
    const result = await getInvestorReportSalesByPyme(
      {
        wallets: fakeWallet(ACCOUNT),
        reports: fakeReports({ listSalesByPyme: async () => ({ ok: true as const, value: SALES }) }),
        now: NOW
      },
      { userId: USER_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Latest period is 2026-07, so the default window is 2026-02..2026-07.
    expect(result.value.pymes.map((entry) => entry.period)).toEqual(["2026-06", "2026-06", "2026-07"]);
  });

  it("rejects a malformed or inverted range before reading the repository", async () => {
    const listSalesByPyme = vi.fn(async () => ({ ok: true as const, value: [] }));
    const result = await getInvestorReportSalesByPyme(
      { wallets: fakeWallet(ACCOUNT), reports: fakeReports({ listSalesByPyme }), now: NOW },
      { userId: USER_ID, from: "2026-06", to: "2026-01" }
    );

    expect(result).toEqual({ ok: false, error: { code: "invalid_request" } });
    expect(listSalesByPyme).not.toHaveBeenCalled();
  });

  it("reports unavailable when the sales read fails", async () => {
    const result = await getInvestorReportSalesByPyme(
      {
        wallets: fakeWallet(ACCOUNT),
        reports: fakeReports({ listSalesByPyme: async () => ({ ok: false as const, error: { code: "unavailable" } }) }),
        now: NOW
      },
      { userId: USER_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

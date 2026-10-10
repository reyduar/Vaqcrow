import { describe, expect, it } from "vitest";
import type { InvestorReport } from "@/application/ports/report-port";
import { buildReportKpis } from "./kpis";

function report(overrides: Partial<InvestorReport["kpis"]> = {}, availableRange: InvestorReport["availableRange"] = { firstPeriod: "2026-04", lastPeriod: "2026-09" }): InvestorReport {
  return {
    range: { from: "2026-04", to: "2026-09" },
    availableRange,
    isEmpty: false,
    kpis: {
      contributedXlm: "850.0000000",
      confirmedDistributionsXlm: "17.3750000",
      pendingDistributionsCount: 1,
      pendingDistributionsXlm: "4.0850000",
      campaignsCount: 3,
      ...overrides
    },
    monthlySeries: [],
    latestDistributions: [],
    contributionTransactions: []
  };
}

describe("buildReportKpis", () => {
  it("renders the four template KPIs in order with their sources", () => {
    const kpis = buildReportKpis(report());

    expect(kpis.map((kpi) => kpi.label)).toEqual([
      "Aportado en el período",
      "Distribuciones confirmadas",
      "Pendientes de confirmación",
      "Campañas con aporte"
    ]);
    expect(kpis.map((kpi) => kpi.source)).toEqual(["TESTNET", "SIMULADO", "TESTNET", "SIMULADO"]);
  });

  it("formats every XLM value with seven decimals", () => {
    const kpis = buildReportKpis(report());
    expect(kpis[0]!.value).toBe("850,0000000 XLM");
    expect(kpis[1]!.value).toBe("17,3750000 XLM");
  });

  it("shows the pending count as the value and its XLM amount in the note", () => {
    const kpis = buildReportKpis(report());
    expect(kpis[2]!.value).toBe("1");
    expect(kpis[2]!.note).toBe("4,0850000 XLM · enviada");
  });

  it("never turns a null pending amount into a zero", () => {
    const kpis = buildReportKpis(
      report({ pendingDistributionsCount: 0, pendingDistributionsXlm: null })
    );
    expect(kpis[2]!.value).toBe("0");
    expect(kpis[2]!.note).toBe("Sin pendientes en el período");
    expect(kpis[2]!.note).not.toContain("XLM");
  });

  it("pluralises the pending note for more than one distribution", () => {
    const kpis = buildReportKpis(
      report({ pendingDistributionsCount: 2, pendingDistributionsXlm: "9.0000000" })
    );
    expect(kpis[2]!.value).toBe("2");
    expect(kpis[2]!.note).toBe("9,0000000 XLM · enviadas");
  });

  it("describes the campaigns count without inventing a breakdown", () => {
    const one = buildReportKpis(report({ campaignsCount: 1 }));
    expect(one[3]!.value).toBe("1");
    expect(one[3]!.note).toBe("1 campaña con aporte en el período");

    const none = buildReportKpis(report({ campaignsCount: 0, contributedXlm: "0.0000000" }));
    expect(none[3]!.note).toBe("Sin campañas con aporte en el período");
  });
});

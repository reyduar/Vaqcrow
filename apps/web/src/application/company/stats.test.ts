import { describe, expect, it } from "vitest";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import { buildDashboardStats } from "./stats";

function campaign(overrides: Partial<MyCampaign> = {}): MyCampaign {
  return {
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    name: "Campaña 2026 · Panadería Horizonte",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
    vaultExplorerUrl: null,
    state: "funding",
    goalArs: 15_000_000,
    raisedArs: 9_450_000,
    fundedPercentBps: 6_300,
    deadline: "2026-11-30T12:00:00.000Z",
    contributorsCount: 38,
    distributions: [],
    sales: [],
    ...overrides
  };
}

describe("buildDashboardStats", () => {
  it("builds the Fondeado and Aportantes tiles for a single campaign", () => {
    const stats = buildDashboardStats([campaign()]);

    expect(stats).toEqual([
      {
        id: "funded",
        label: "Fondeado",
        value: "ARS 9.450.000",
        note: "de ARS 15.000.000 · cierra el 30/11/2026"
      },
      {
        id: "contributors",
        label: "Aportantes",
        value: "38",
        note: "Cuentas de Testnet distintas"
      }
    ]);
  });

  it("totals raised, goals and contributors across every campaign", () => {
    const stats = buildDashboardStats([
      campaign(),
      campaign({
        campaignId: "99999999-9999-4999-8999-999999999999",
        goalArs: 5_000_000,
        raisedArs: 2_550_000,
        contributorsCount: 12,
        deadline: "2026-12-31T12:00:00.000Z"
      })
    ]);

    expect(stats[0]!.value).toBe("ARS 12.000.000");
    expect(stats[0]!.note).toBe("de ARS 20.000.000 · cierra el 30/11/2026");
    expect(stats[1]!.value).toBe("50");
  });

  it("reports Sin dato and drops the deadline note when a raised total is unknown", () => {
    const stats = buildDashboardStats([campaign({ raisedArs: null, deadline: "not-a-date" })]);

    expect(stats[0]!.value).toBe("Sin dato");
    expect(stats[0]!.note).toBe("de ARS 15.000.000");
  });

  it("never totals a partial sum: one unknown raised total makes the figure Sin dato", () => {
    const stats = buildDashboardStats([campaign(), campaign({ campaignId: "b", raisedArs: null })]);
    expect(stats[0]!.value).toBe("Sin dato");
  });
});

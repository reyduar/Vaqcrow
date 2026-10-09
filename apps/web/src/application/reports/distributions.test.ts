import { describe, expect, it } from "vitest";
import type { ReportLatestDistribution, ReportSalesByPymeEntry } from "@/application/ports/report-port";
import { toDistributionRows, toSalesRows } from "./distributions";

const DISTRIBUTIONS: readonly ReportLatestDistribution[] = [
  {
    date: "2026-09-26T12:00:00.000Z",
    pyme: "Café Tostadero del Paraná",
    declaredSalesArs: 3_870_000,
    shareXlm: "4.0850000",
    state: "submitted"
  },
  {
    date: "2026-09-25T12:00:00.000Z",
    pyme: "Panadería Horizonte SRL",
    declaredSalesArs: null,
    shareXlm: null,
    state: "confirmed"
  },
  {
    date: "2026-08-28T12:00:00.000Z",
    pyme: "Café Tostadero del Paraná",
    declaredSalesArs: 3_902_100,
    shareXlm: "4.1200000",
    state: "failed"
  }
];

describe("toDistributionRows", () => {
  it("formats the date, declared sales and this investor's share", () => {
    const rows = toDistributionRows(DISTRIBUTIONS);
    expect(rows[0]).toMatchObject({
      date: "26/09/2026",
      pyme: "Café Tostadero del Paraná",
      sales: "ARS 3.870.000",
      share: "4,0850000 XLM",
      state: "Enviada · pendiente",
      tone: "caution"
    });
  });

  it("never turns a missing sale or share into a zero", () => {
    const rows = toDistributionRows(DISTRIBUTIONS);
    expect(rows[1]).toMatchObject({ sales: "Sin dato", share: "Sin distribución", state: "Confirmada", tone: "success" });
  });

  it("maps a failed distribution to the critical tone", () => {
    const rows = toDistributionRows(DISTRIBUTIONS);
    expect(rows[2]).toMatchObject({ state: "Fallida", tone: "critical" });
  });
});

const PYMES: readonly ReportSalesByPymeEntry[] = [
  {
    name: "Café Tostadero del Paraná",
    sector: "Gastronomía · Rosario",
    imageSrc: "http://localhost:3000/marketplace/campaigns/abc/image",
    period: "2026-08",
    salesArs: 3_902_100,
    status: "reported"
  },
  {
    name: "Panadería Horizonte SRL",
    sector: "Alimentos · Córdoba",
    imageSrc: null,
    period: "2026-08",
    salesArs: null,
    status: "missing"
  },
  {
    name: "Florería Jardín del Sur",
    sector: "Comercio minorista · Mar del Plata",
    imageSrc: null,
    period: "2026-08",
    salesArs: 1_284_000,
    status: "anomalous"
  }
];

describe("toSalesRows", () => {
  it("formats the amount and the month label", () => {
    const rows = toSalesRows(PYMES);
    expect(rows[0]).toMatchObject({
      name: "Café Tostadero del Paraná",
      amount: "ARS 3.902.100",
      monthLabel: "agosto",
      statusLabel: "Declarada en término"
    });
  });

  it("never turns a missing declared sale into a zero", () => {
    const rows = toSalesRows(PYMES);
    expect(rows[1]).toMatchObject({ amount: "Sin dato", status: "missing", statusLabel: "Sin declaración en el período" });
  });

  it("marks an anomalous declaration", () => {
    const rows = toSalesRows(PYMES);
    expect(rows[2]).toMatchObject({ status: "anomalous", statusLabel: "Declaración con anomalía" });
  });
});

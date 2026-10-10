import { describe, expect, it } from "vitest";
import type { MyCampaignSalesMonth } from "@/application/ports/my-campaigns-port";
import { SALES_STATUS_COPY, salesChartTitle, salesYear, toSalesBars } from "./sales";

const SALES: readonly MyCampaignSalesMonth[] = [
  { period: "2026-06", salesArs: 6_240_000, status: "anomalous" },
  { period: "2026-08", salesArs: 3_745_800, status: "reported" },
  { period: "2026-07", salesArs: null, status: "missing" }
];

describe("company sales", () => {
  it("maps each declared month to a bar with a formatted value and status", () => {
    const bars = toSalesBars(SALES);

    expect(bars[1]).toEqual({
      period: "2026-08",
      label: "Agosto",
      value: 3_745_800,
      displayValue: "ARS 3.745.800",
      status: "reported"
    });
    expect(bars[0]!.status).toBe("anomalous");
  });

  it("renders a missing month as a null height and Sin dato, never a zero", () => {
    const bar = toSalesBars(SALES)[2]!;
    expect(bar.value).toBeNull();
    expect(bar.displayValue).toBe("Sin dato");
    expect(bar.status).toBe("missing");
  });

  it("keeps the source order of the months", () => {
    expect(toSalesBars(SALES).map((bar) => bar.period)).toEqual(["2026-06", "2026-08", "2026-07"]);
  });

  it("derives the chart year from the latest declared period", () => {
    expect(salesYear(SALES)).toBe("2026");
    expect(salesYear([])).toBeNull();
    expect(salesYear([{ period: "2025-12", salesArs: 1, status: "reported" }])).toBe("2025");
  });

  it("builds the title with the year, or without it when there is no data", () => {
    expect(salesChartTitle(SALES)).toBe("Ventas declaradas · 2026");
    expect(salesChartTitle([])).toBe("Ventas declaradas");
  });

  it("exposes the three status labels", () => {
    expect(SALES_STATUS_COPY).toEqual({
      reported: "Declarada en término",
      missing: "Sin declaración en el período",
      anomalous: "Declaración con anomalía"
    });
  });
});

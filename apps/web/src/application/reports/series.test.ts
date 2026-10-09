import { describe, expect, it } from "vitest";
import type { ReportMonthlyPoint } from "@/application/ports/report-port";
import { toChartSeries } from "./series";

const SERIES: readonly ReportMonthlyPoint[] = [
  { period: "2026-04", amountXlm: null, state: "none" },
  { period: "2026-05", amountXlm: "3.2100000", state: "confirmed" },
  { period: "2026-06", amountXlm: "5.9400000", state: "confirmed" },
  { period: "2026-09", amountXlm: "4.0850000", state: "pending" }
];

describe("toChartSeries", () => {
  it("maps every month to the template's short label and state vocabulary", () => {
    const points = toChartSeries(SERIES);

    expect(points.map((point) => point.shortLabel)).toEqual(["Abr", "May", "Jun", "Sep"]);
    expect(points.map((point) => point.stateLabel)).toEqual([
      "Sin distribución",
      "Confirmada",
      "Confirmada",
      "Pendiente de confirmación"
    ]);
    expect(points[3]!.monthLabel).toBe("septiembre 2026");
  });

  it("keeps a none month honest: no value, no zero", () => {
    const [april] = toChartSeries(SERIES);
    expect(april!.state).toBe("none");
    expect(april!.value).toBeNull();
    expect(april!.displayValue).toBe("Sin distribución");
    expect(april!.topLabel).toBe("—");
    expect(april!.heightPercent).toBe(8);
  });

  it("formats the XLM cell with seven decimals", () => {
    const [, may] = toChartSeries(SERIES);
    expect(may!.displayValue).toBe("3,2100000 XLM");
  });

  it("scales the tallest month to 88% and never above it", () => {
    const points = toChartSeries(SERIES);
    const heights = points.map((point) => point.heightPercent);
    // June (5.94, confirmed) is the tallest month and anchors the scale.
    expect(Math.max(...heights)).toBe(88);
    expect(points[1]!.heightPercent).toBe(48);
    expect(points[2]!.heightPercent).toBe(88);
    expect(points[3]!.heightPercent).toBe(61);
  });

  it("returns an empty series for an empty month list", () => {
    expect(toChartSeries([])).toEqual([]);
  });
});

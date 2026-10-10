import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { toChartSeries } from "@/application/reports/series";
import type { ReportMonthlyPoint } from "@/application/ports/report-port";
import { ReportMonthlyChart } from "./report-monthly-chart";

const SERIES: readonly ReportMonthlyPoint[] = [
  { period: "2026-04", amountXlm: null, state: "none" },
  { period: "2026-08", amountXlm: "4.1200000", state: "confirmed" },
  { period: "2026-09", amountXlm: "4.0850000", state: "pending" }
];

describe("ReportMonthlyChart", () => {
  it("shows the loading placeholder while the series is in flight", () => {
    render(<ReportMonthlyChart series={[]} rangeLabel="abril – septiembre 2026" isLoading />);
    expect(screen.getByText("Cargando serie…")).toBeInTheDocument();
  });

  it("renders the caption, the SIMULADO badge and the full legend", () => {
    render(<ReportMonthlyChart series={toChartSeries(SERIES)} rangeLabel="abril – septiembre 2026" />);

    expect(screen.getByText("XLM de prueba · abril – septiembre 2026")).toBeInTheDocument();
    expect(screen.getByText("SIMULADO")).toBeInTheDocument();
    const legend = document.querySelector('[data-part="legend"]') as HTMLElement;
    expect(within(legend).getByText("Confirmada")).toBeInTheDocument();
    expect(within(legend).getByText("Pendiente de confirmación")).toBeInTheDocument();
    expect(within(legend).getByText("Sin distribución")).toBeInTheDocument();
  });

  it("provides the accessible table with 7-decimal XLM and honest none rows", () => {
    render(<ReportMonthlyChart series={toChartSeries(SERIES)} rangeLabel="abril – septiembre 2026" />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Estado" })).toBeInTheDocument();
    expect(within(table).getByText("abril 2026")).toBeInTheDocument();
    expect(within(table).getAllByText("Sin distribución").length).toBeGreaterThan(0);
    expect(within(table).getByText("4,1200000 XLM")).toBeInTheDocument();
    expect(within(table).getByText("4,0850000 XLM")).toBeInTheDocument();
  });
});

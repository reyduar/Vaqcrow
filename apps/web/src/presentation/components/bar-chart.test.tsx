import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarChart, type BarChartPoint } from "./bar-chart";

const REPORTED_POINT: BarChartPoint = {
  label: "Enero 2026",
  value: 50,
  displayValue: "ARS 50"
};

const MISSING_POINT: BarChartPoint = {
  label: "Abril 2026",
  value: null,
  displayValue: "Dato faltante",
  status: "missing"
};

const ANOMALOUS_POINT: BarChartPoint = {
  label: "Junio 2026",
  value: 100,
  displayValue: "ARS 100",
  status: "anomalous"
};

function renderChart(series: readonly BarChartPoint[] = [REPORTED_POINT, MISSING_POINT, ANOMALOUS_POINT]) {
  return render(
    <BarChart title="Ventas mensuales" caption="Enero – agosto 2026 · ARS" series={series} tableCaption="Ventas mensuales sintéticas" />
  );
}

describe("BarChart", () => {
  it("renders the title and caption", () => {
    renderChart();

    expect(screen.getByText("Ventas mensuales")).toBeInTheDocument();
    expect(screen.getByText("Enero – agosto 2026 · ARS")).toBeInTheDocument();
  });

  it("renders an accessible table with the required columns and one row per point", () => {
    renderChart();

    const table = screen.getByRole("table", { name: "Ventas mensuales sintéticas" });
    for (const header of ["Período", "Valor", "Estado"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(within(table).getAllByRole("row")).toHaveLength(4); // header + 3 points
  });

  it("renders the caller-formatted displayValue for every point in the table", () => {
    renderChart();

    const table = screen.getByRole("table");
    expect(within(table).getByText("ARS 50")).toBeInTheDocument();
    expect(within(table).getByText("Dato faltante")).toBeInTheDocument();
    expect(within(table).getByText("ARS 100")).toBeInTheDocument();
  });

  it("labels a reported point as Declarado in the accessible table", () => {
    renderChart();

    const row = screen.getByRole("row", { name: /Enero 2026/ });
    expect(within(row).getByText("Declarado")).toBeInTheDocument();
  });

  it("marks a missing point as Sin dato — never rendered as a zero value", () => {
    renderChart();

    const row = screen.getByRole("row", { name: /Abril 2026/ });
    expect(within(row).getByText("Sin dato")).toBeInTheDocument();
    expect(within(row).queryByText(/^\$?\s?0$/)).not.toBeInTheDocument();

    // The decorative visual side must also show an explicit "Sin dato" gap,
    // never a zero-height bar standing in for the missing month.
    expect(screen.getAllByText("Sin dato").length).toBeGreaterThanOrEqual(2);
  });

  it("marks an anomalous point with a non-colour text marker, both visually and in the table", () => {
    renderChart();

    const row = screen.getByRole("row", { name: /Junio 2026/ });
    expect(within(row).getByText("Atípico")).toBeInTheDocument();
    expect(screen.getAllByText("Atípico").length).toBeGreaterThanOrEqual(2);
  });

  it("sizes bars proportionally to the maximum value in the series", () => {
    render(
      <BarChart
        title="Serie"
        series={[
          { label: "A", value: 50, displayValue: "50" },
          { label: "B", value: 100, displayValue: "100" }
        ]}
        tableCaption="Serie"
      />
    );

    const bars = document.querySelectorAll('[data-part="bar"]');
    expect(bars).toHaveLength(2);
    expect((bars[0] as HTMLElement).style.height).toBe("50%");
    expect((bars[1] as HTMLElement).style.height).toBe("100%");
  });

  it("hides the decorative visual chart from assistive tech", () => {
    renderChart();

    const visual = document.querySelector('[data-part="chart-visual"]');
    expect(visual).toHaveAttribute("aria-hidden", "true");
  });

  it("nests the accessible table inside a collapsed details/summary", () => {
    renderChart();

    const details = document.querySelector("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("Ver tabla accesible").closest("summary")).toBeInTheDocument();
  });

  it("renders the caller-supplied synthetic-series notice only when provided", () => {
    const { rerender } = renderChart();
    expect(screen.queryByText(/Serie sintética/)).not.toBeInTheDocument();

    rerender(
      <BarChart
        title="Ventas mensuales"
        series={[REPORTED_POINT]}
        tableCaption="Ventas mensuales sintéticas"
        notice="Serie sintética y reproducible; abril está ausente y junio contiene una anomalía intencional"
      />
    );
    expect(
      screen.getByText("Serie sintética y reproducible; abril está ausente y junio contiene una anomalía intencional")
    ).toBeInTheDocument();
  });

  it("renders the title at a configurable heading level, defaulting to h3", () => {
    renderChart();
    expect(screen.getByRole("heading", { level: 3, name: "Ventas mensuales" })).toBeInTheDocument();

    render(
      <BarChart title="Otro título" headingLevel={2} series={[REPORTED_POINT]} tableCaption="Otro título" />
    );
    expect(screen.getByRole("heading", { level: 2, name: "Otro título" })).toBeInTheDocument();
  });

  it("marks the growing bars reduced-motion aware via the motion-reduce variant", () => {
    renderChart();

    const bar = document.querySelector('[data-part="bar"]');
    expect(bar?.className).toContain("motion-reduce:transition-none");
  });
});

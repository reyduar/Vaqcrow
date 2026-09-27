import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { panaderiaHorizonte } from "@/application/fixtures/panaderia-horizonte";
import { microcopy } from "@/application/trust/disclosures";
import { BarChart, type BarChartPoint } from "./bar-chart";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0
});

/**
 * BarChart: the "Ventas mensuales" chart from `Vaqcrow Sistema.dc.html`,
 * built from the frozen Panadería Horizonte SRL synthetic sales series
 * (Feature #17). April renders as an explicit "Sin dato" gap — never zero —
 * and June renders with its non-colour "Atípico" marker; both also carry
 * their formatted status text in the accessible table. `value`/`displayValue`
 * are computed once here from the fixture, matching the "presentational
 * only" rule — the component itself performs no currency formatting.
 */
const salesSeries: readonly BarChartPoint[] = panaderiaHorizonte.sales.map((period) => ({
  label: period.label,
  value: period.amountArs,
  displayValue: period.amountArs === null ? "Dato faltante" : currencyFormatter.format(period.amountArs),
  status: period.status
}));

const meta = {
  title: "Datos/BarChart",
  component: BarChart,
  args: {
    title: "Ventas mensuales",
    caption: "Enero – agosto 2026 · ARS",
    series: salesSeries,
    tableCaption: "Ventas mensuales sintéticas — Panadería Horizonte SRL"
  }
} satisfies Meta<typeof BarChart>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** With the canonical synthetic-series notice, sourced from `microcopy`. */
export const WithNotice: Story = {
  args: { notice: microcopy.salesSynthetic }
};

export const CustomHeadingLevel: Story = {
  args: { headingLevel: 2 }
};

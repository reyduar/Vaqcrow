import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { microcopy } from "@/application/trust/disclosures";
import { BarChart, type BarChartPoint } from "./bar-chart";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0
});

/**
 * BarChart: the "Ventas mensuales" chart from `Vaqcrow Sistema.dc.html`,
 * built from an inline synthetic sales series for the fictional Panadería
 * Horizonte SRL (the former journey fixture, retired with #438). April renders as an explicit "Sin dato" gap — never zero —
 * and June renders with its non-colour "Atípico" marker; both also carry
 * their formatted status text in the accessible table. `value`/`displayValue`
 * are computed once here from that series, matching the "presentational
 * only" rule — the component itself performs no currency formatting.
 */
const SYNTHETIC_SALES: ReadonlyArray<{
  readonly label: string;
  readonly amountArs: number | null;
  readonly status: "reported" | "missing" | "anomalous";
}> = [
  { label: "Enero 2026", amountArs: 3_150_000, status: "reported" },
  { label: "Febrero 2026", amountArs: 3_320_500, status: "reported" },
  { label: "Marzo 2026", amountArs: 3_410_750, status: "reported" },
  { label: "Abril 2026", amountArs: null, status: "missing" },
  { label: "Mayo 2026", amountArs: 3_580_900, status: "reported" },
  { label: "Junio 2026", amountArs: 6_240_000, status: "anomalous" },
  { label: "Julio 2026", amountArs: 3_690_300, status: "reported" },
  { label: "Agosto 2026", amountArs: 3_745_800, status: "reported" }
];

const salesSeries: readonly BarChartPoint[] = SYNTHETIC_SALES.map((period) => ({
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

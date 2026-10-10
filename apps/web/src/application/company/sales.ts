import type { MyCampaignSalesStatus } from "@vaqcrow/contracts";
import type { MyCampaignSalesMonth } from "@/application/ports/my-campaigns-port";
import { formatArsAmount, formatMonthName } from "./format";

/**
 * The «Ventas declaradas» bar series for the PyME dashboard (Feature #434,
 * WU2). Pure and React-free: it maps the API's own `reported | missing |
 * anomalous` statuses onto the `bar-chart` statuses unchanged (the chart
 * already renders a non-colour "Sin dato"/"Atípico" marker, so no status is
 * baked into the label). A `missing` month carries no number: `value` is `null`
 * and the cell reads "Sin dato", never a fabricated zero bar.
 */

export interface SalesBar {
  readonly period: string;
  /** Capitalised month name, e.g. `Agosto`. */
  readonly label: string;
  /** Bar-height input; `null` exactly for a `missing` month. */
  readonly value: number | null;
  /** Already formatted for the accessible table cell. */
  readonly displayValue: string;
  readonly status: MyCampaignSalesStatus;
}

export const SALES_STATUS_COPY: Readonly<Record<MyCampaignSalesStatus, string>> = {
  reported: "Declarada en término",
  missing: "Sin declaración en el período",
  anomalous: "Declaración con anomalía"
};

const SIN_DATO = "Sin dato";

export function toSalesBars(sales: readonly MyCampaignSalesMonth[]): readonly SalesBar[] {
  return sales.map((month) => ({
    period: month.period,
    label: formatMonthName(month.period),
    value: month.salesArs,
    displayValue: month.salesArs === null ? SIN_DATO : formatArsAmount(month.salesArs),
    status: month.status
  }));
}

/** The calendar year of the latest declared period, or `null` when there is none. */
export function salesYear(sales: readonly MyCampaignSalesMonth[]): string | null {
  const latest = sales.reduce<string | null>((highest, month) => (highest === null || month.period > highest ? month.period : highest), null);
  return latest === null ? null : latest.slice(0, 4);
}

/** `"Ventas declaradas · 2026"`, or `"Ventas declaradas"` without any data. */
export function salesChartTitle(sales: readonly MyCampaignSalesMonth[]): string {
  const year = salesYear(sales);
  return year === null ? "Ventas declaradas" : `Ventas declaradas · ${year}`;
}

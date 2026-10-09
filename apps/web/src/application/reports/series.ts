import type { ReportMonthlyPoint } from "@/application/ports/report-port";
import { formatXlmAmount, formatXlmValue } from "./format";
import { formatPeriod, formatPeriodShort } from "./periods";

/**
 * The monthly distribution series of `Vaqcrow Informes.dc.html` (Feature #430,
 * WU2). Pure and React-free: it maps the API's `confirmed | pending | none`
 * months to everything the chart needs, so the component never does arithmetic.
 *
 * The only numeric conversion is the bar height (`value`), which is decorative
 * and never leaves this view. A `none` month carries no number at all: the
 * template draws a dashed stub (`heightPercent` 8) labelled `Sin distribución`,
 * and that is exactly what this mapper emits — never a fabricated zero bar.
 */

export type ReportSeriesState = ReportMonthlyPoint["state"];

export interface ReportChartPoint {
  readonly period: string;
  /** Three-letter x-axis label, e.g. `Sep`. */
  readonly shortLabel: string;
  /** Full month, e.g. `septiembre 2026`. */
  readonly monthLabel: string;
  readonly state: ReportSeriesState;
  /** Bar-height input; `null` only for a `none` month. */
  readonly value: number | null;
  /** Accessible-table XLM cell, e.g. `4,0850000 XLM`, or `Sin distribución`. */
  readonly displayValue: string;
  /** Decorative bar-top label, e.g. `4,0850000`, or `—`. */
  readonly topLabel: string;
  /** Decorative bar height in percent (max month = 88, `none` = 8). */
  readonly heightPercent: number;
  /** Estado cell / legend vocabulary. */
  readonly stateLabel: string;
}

const STATE_LABELS: Readonly<Record<ReportSeriesState, string>> = {
  confirmed: "Confirmada",
  pending: "Pendiente de confirmación",
  none: "Sin distribución"
};

const NONE_HEIGHT_PERCENT = 8;
const MAX_HEIGHT_PERCENT = 88;

function numeric(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toChartSeries(points: readonly ReportMonthlyPoint[]): readonly ReportChartPoint[] {
  const heights = points.map((point) => numeric(point.amountXlm));
  const max = heights.reduce<number>((highest, value) => (value !== null && value > highest ? value : highest), 0);

  return points.map((point) => {
    const value = numeric(point.amountXlm);
    const heightPercent =
      value === null || max <= 0
        ? NONE_HEIGHT_PERCENT
        : Math.max(NONE_HEIGHT_PERCENT, Math.min(MAX_HEIGHT_PERCENT, Math.round((value / max) * MAX_HEIGHT_PERCENT)));
    return {
      period: point.period,
      shortLabel: formatPeriodShort(point.period),
      monthLabel: formatPeriod(point.period),
      state: point.state,
      value,
      displayValue: point.amountXlm === null ? STATE_LABELS.none : formatXlmAmount(point.amountXlm),
      topLabel: point.amountXlm === null ? "—" : formatXlmValue(point.amountXlm),
      heightPercent,
      stateLabel: STATE_LABELS[point.state]
    };
  });
}

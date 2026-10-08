/**
 * es-AR display formatting for the marketplace cards (Feature #414, WU4a).
 * React-free and `Intl`-based; whole pesos only, because the API sends integer
 * ARS. This module never turns a missing value into a zero — callers decide how
 * to render "sin dato" before calling in.
 */

const ARS_FORMATTER = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const CLOSE_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
const PERCENT_FORMATTER = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/** `9450000` → `"ARS 9.450.000"`. */
export function formatArsAmount(value: number): string {
  return `ARS ${ARS_FORMATTER.format(value)}`;
}

/** `"2026-11-30T12:00:00.000Z"` → `"30/11/2026"`; an invalid date is the empty string. */
export function formatCloseDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return CLOSE_DATE_FORMATTER.format(date);
}

/** Basis points to a rounded whole percent, clamped to `0..100`. */
export function fundedPercent(fundedPercentBps: number): number {
  return Math.min(100, Math.max(0, Math.round(fundedPercentBps / 100)));
}

/** `6300` → `"63 % de la meta"`. */
export function formatFundedPercentLabel(fundedPercentBps: number): string {
  return `${fundedPercent(fundedPercentBps)} % de la meta`;
}

/** `4.5` → `"4,5 % de ventas"` (up to two decimals, comma). */
export function formatRevenueSharePercent(value: number): string {
  return `${PERCENT_FORMATTER.format(value)} % de ventas`;
}

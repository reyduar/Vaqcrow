/**
 * Display formatting for the investor report (Feature #430, WU2). Pure and
 * React-free. The canonical XLM is a 7-decimal string; this only formats it for
 * reading, never performs arithmetic on money. `null` is the caller's to render
 * as "Sin dato" — this module never turns an absence into a zero.
 */

const XLM_FORMATTER = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 7,
  maximumFractionDigits: 7
});

const ARS_FORMATTER = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

// UTC keeps the rendered day deterministic across environments: the API sends a
// confirmation timestamp with an explicit offset and the report only cares
// about the day it happened.
const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC"
});

/** Canonical XLM (7 decimals) -> `1.250,0000000 XLM`. */
export function formatXlmAmount(xlm: string): string {
  const value = Number(xlm);
  return Number.isFinite(value) ? `${XLM_FORMATTER.format(value)} XLM` : xlm;
}

/** Canonical XLM (7 decimals) -> `1.250,0000000` (the chart's bar-top label). */
export function formatXlmValue(xlm: string): string {
  const value = Number(xlm);
  return Number.isFinite(value) ? XLM_FORMATTER.format(value) : xlm;
}

/** `3902100` -> `"ARS 3.902.100"`. */
export function formatArsAmount(value: number): string {
  return `ARS ${ARS_FORMATTER.format(value)}`;
}

/** `"2026-09-26T12:00:00.000Z"` -> `"26/09/2026"`; an invalid date is the empty string. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return DATE_FORMATTER.format(date);
}

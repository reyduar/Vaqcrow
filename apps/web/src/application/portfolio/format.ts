/**
 * Display formatting for the portfolio (Feature #426, WU2). The canonical XLM
 * is a 7-decimal string; this only formats it for reading, the same way
 * `wallet-card.tsx` does (`Intl.NumberFormat("es-AR")` with exactly seven
 * fraction digits). No arithmetic happens here. Pure and React-free.
 */

const XLM_FORMATTER = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 7,
  maximumFractionDigits: 7
});

// UTC keeps the rendered day deterministic across environments (#438/WU5),
// the same rule the report's `formatDate` follows.
const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC"
});

/** `"2026-10-08T10:05:00.000Z"` -> `"08/10/2026"`; an invalid date is the empty string. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : DATE_FORMATTER.format(date);
}

/** Canonical XLM (7 decimals) -> `1.250,0000000 XLM`. */
export function formatXlmAmount(xlm: string): string {
  const value = Number(xlm);
  return Number.isFinite(value) ? `${XLM_FORMATTER.format(value)} XLM` : xlm;
}

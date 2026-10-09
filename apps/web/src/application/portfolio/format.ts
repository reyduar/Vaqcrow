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

/** Canonical XLM (7 decimals) -> `1.250,0000000 XLM`. */
export function formatXlmAmount(xlm: string): string {
  const value = Number(xlm);
  return Number.isFinite(value) ? `${XLM_FORMATTER.format(value)} XLM` : xlm;
}

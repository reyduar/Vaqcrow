/**
 * Display formatting for the portfolio (Feature #426, WU2). The canonical XLM
 * is a 7-decimal string; it is rendered through the single 2-decimal display
 * formatter (`../format/xlm`, #572). No arithmetic happens here. Pure and React-free.
 */

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

/** XLM amounts use the single 2-decimal display formatter (#572). */
export { formatXlmAmount } from "../format/xlm";

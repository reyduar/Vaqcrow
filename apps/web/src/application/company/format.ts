/**
 * Display formatting for the PyME «Mi campaña» dashboard (Feature #434, WU2).
 * Pure and React-free. ARS is integer-only; XLM is a canonical 7-decimal
 * string. This only formats for reading — it never converts ARS to XLM, so the
 * synthetic rate always stays the endpoint's own. `null` is the caller's to
 * render as «Sin dato»; this module never turns an absence into a zero.
 */

const XLM_FORMATTER = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 7,
  maximumFractionDigits: 7
});

const ARS_FORMATTER = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

// UTC keeps the rendered day deterministic across environments: the API sends a
// datetime with an explicit offset and the dashboard only cares about the day.
const DAY_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC"
});

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
] as const;

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function periodParts(period: string): { readonly year: string; readonly month: number } | null {
  if (!PERIOD_PATTERN.test(period)) return null;
  return { year: period.slice(0, 4), month: Number(period.slice(5, 7)) };
}

/** `9450000` -> `"ARS 9.450.000"`. */
export function formatArsAmount(value: number): string {
  return `ARS ${ARS_FORMATTER.format(value)}`;
}

/** Canonical XLM (7 decimals) -> `1.250,0000000` (no unit). */
export function formatXlmValue(xlm: string): string {
  const value = Number(xlm);
  return Number.isFinite(value) ? XLM_FORMATTER.format(value) : xlm;
}

/** Canonical XLM (7 decimals) -> `1.250,0000000 XLM`. */
export function formatXlmAmount(xlm: string): string {
  const value = Number(xlm);
  return Number.isFinite(value) ? `${XLM_FORMATTER.format(value)} XLM` : xlm;
}

/** Canonical XLM -> `≈ 1.250,0000000 XLM`, marking the synthetic conversion. */
export function formatApproxXlmAmount(xlm: string): string {
  return `≈ ${formatXlmValue(xlm)} XLM`;
}

/** `"2026-11-30T12:00:00.000Z"` -> `"30/11/2026"`; an invalid date is the empty string. */
export function formatDeadlineDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return DAY_FORMATTER.format(date);
}

/** `2026-08` -> `Agosto`; an invalid period is returned unchanged. */
export function formatMonthName(period: string): string {
  const parts = periodParts(period);
  return parts === null ? period : MONTH_NAMES[parts.month - 1]!;
}

/** `2026-08` -> `Agosto 2026`; an invalid period is returned unchanged. */
export function formatMonthYear(period: string): string {
  const parts = periodParts(period);
  return parts === null ? period : `${MONTH_NAMES[parts.month - 1]!} ${parts.year}`;
}

/** `CDLZ…4B2` — the vault address as the template abbreviates it. */
export function formatShortAddress(address: string): string {
  if (address.length <= 9) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

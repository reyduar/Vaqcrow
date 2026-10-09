import type { AvailableRange } from "@/application/ports/report-port";

/**
 * Period arithmetic and range labels for the investor report (Feature #430,
 * WU2). Pure and React-free. Periods are `YYYY-MM` strings compared
 * lexicographically — never a `Date`, so there is no timezone drift in
 * bucketing. The locale strings are Latin-American Spanish ("septiembre", not
 * "setiembre"; short axis labels "Abr"/"Sep") matching the template.
 */

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
] as const;

const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;

/** One selectable preset, built from the investor's own data range. */
export interface PeriodPreset {
  readonly id: "6m" | "3m" | "latest";
  /** Lower-case range label, e.g. `abril – septiembre 2026`. */
  readonly label: string;
  readonly from: string;
  readonly to: string;
}

/** `2026-04` -> `{"2026","04"}`; `null` when the string is not a month. */
function parts(period: string): { readonly year: string; readonly month: number } | null {
  if (!PERIOD_PATTERN.test(period)) return null;
  return { year: period.slice(0, 4), month: Number(period.slice(5, 7)) };
}

/** Adds whole months to a `YYYY-MM` period with integer math only. */
export function addMonths(period: string, delta: number): string {
  const split = parts(period);
  if (split === null) return period;
  const absolute = Number(split.year) * 12 + (split.month - 1) + delta;
  const nextYear = Math.floor(absolute / 12);
  const nextMonth = (((absolute % 12) + 12) % 12) + 1;
  return `${nextYear.toString().padStart(4, "0")}-${nextMonth.toString().padStart(2, "0")}`;
}

/** `2026-09` -> `septiembre 2026`; an invalid period is returned unchanged. */
export function formatPeriod(period: string): string {
  const split = parts(period);
  if (split === null) return period;
  return `${MONTH_NAMES[split.month - 1]!} ${split.year}`;
}

/** `2026-08` -> `agosto`; an invalid period is returned unchanged. */
export function formatMonthName(period: string): string {
  const split = parts(period);
  return split === null ? period : MONTH_NAMES[split.month - 1]!;
}

/** `2026-04` -> `Abr` (the chart's x-axis label). */
export function formatPeriodShort(period: string): string {
  const split = parts(period);
  return split === null ? period : MONTH_SHORT[split.month - 1]!;
}

/**
 * `("2026-04","2026-09")` -> `abril – septiembre 2026`; a single month has no
 * dash, and a range crossing a year carries both years.
 */
export function formatPeriodRange(from: string, to: string): string {
  if (from === to) return formatPeriod(from);
  const start = parts(from);
  const end = parts(to);
  if (start === null || end === null) return `${formatPeriod(from)} – ${formatPeriod(to)}`;
  const left = start.year === end.year ? MONTH_NAMES[start.month - 1]! : `${MONTH_NAMES[start.month - 1]!} ${start.year}`;
  return `${left} – ${MONTH_NAMES[end.month - 1]!} ${end.year}`;
}

/**
 * Builds the three presets from the investor's `availableRange`: the last six
 * months, the last three months and the single latest month, all anchored to
 * `lastPeriod`. No presets without data — the selector is hidden instead of
 * inventing a range.
 */
export function buildPeriodPresets(available: AvailableRange): readonly PeriodPreset[] {
  const { firstPeriod, lastPeriod } = available;
  if (firstPeriod === null || lastPeriod === null) return [];
  const sixFrom = addMonths(lastPeriod, -5);
  const threeFrom = addMonths(lastPeriod, -2);
  return [
    { id: "6m", label: formatPeriodRange(sixFrom, lastPeriod), from: sixFrom, to: lastPeriod },
    { id: "3m", label: formatPeriodRange(threeFrom, lastPeriod), from: threeFrom, to: lastPeriod },
    { id: "latest", label: formatPeriod(lastPeriod), from: lastPeriod, to: lastPeriod }
  ];
}

/** Accepts a native `YYYY-MM` month value; anything else is `null`. */
export function parseMonthInput(value: string): string | null {
  return PERIOD_PATTERN.test(value) ? value : null;
}

/** True when `period` sits inside the investor's available range. */
export function isWithinAvailable(period: string, available: AvailableRange): boolean {
  const { firstPeriod, lastPeriod } = available;
  if (firstPeriod === null || lastPeriod === null) return false;
  return firstPeriod <= period && period <= lastPeriod;
}

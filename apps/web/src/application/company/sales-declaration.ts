import type { MyCampaignSalesMonth } from "@/application/ports/my-campaigns-port";
import type { SalesDeclarationPeriod } from "@/application/ports/sales-declaration-port";
import { addMonths } from "@/application/reports/periods";

/**
 * Pure helpers of the PyME monthly sales declaration (Feature #434, WU3).
 * React-free: they turn the declare form's raw strings into the exact periods
 * the API accepts, and build the demo sample and window. `null` (an empty
 * amount) is always "Sin dato" — an absence, never a `0`.
 */

/** One editable month row: the period plus the raw amount text (`""` = Sin dato). */
export interface SalesAmountRow {
  readonly period: string;
  readonly amount: string;
}

/** Why a form could not be built into declared periods. */
export type SalesDeclarationBuildFailure = "empty" | "invalid_period" | "invalid_amount";

export type SalesDeclarationBuild =
  | { readonly ok: true; readonly periods: readonly SalesDeclarationPeriod[] }
  | { readonly ok: false; readonly reason: SalesDeclarationBuildFailure };

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const WHOLE_AMOUNT_PATTERN = /^\d+$/;

/** How many months the demo declaration window spans (matches the ≥6-of-8 rule). */
export const DEMO_DECLARE_WINDOW_MONTHS = 8;

/** Deterministic sample figures — same months always fill the same amounts. */
const SAMPLE_BASE_ARS = 1_850_000;
const SAMPLE_STEP_ARS = 240_000;

/**
 * `""` (or blank) -> `null` (Sin dato); a whole non-negative integer -> its
 * number; anything else (negative, decimal, separator, overflow) -> `undefined`
 * so the caller can refuse it instead of silently coercing.
 */
export function parseSalesAmount(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!WHOLE_AMOUNT_PATTERN.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}

/** Validates every row and builds the declared periods; the first bad row refuses the whole form. */
export function buildDeclaredPeriods(rows: readonly SalesAmountRow[]): SalesDeclarationBuild {
  if (rows.length === 0) return { ok: false, reason: "empty" };

  const periods: SalesDeclarationPeriod[] = [];
  for (const row of rows) {
    if (!PERIOD_PATTERN.test(row.period)) return { ok: false, reason: "invalid_period" };
    const amount = parseSalesAmount(row.amount);
    if (amount === undefined) return { ok: false, reason: "invalid_amount" };
    periods.push({ period: row.period, salesArs: amount });
  }

  return { ok: true, periods };
}

/** Pre-fills the declare form from the campaign's own declared months, oldest first. */
export function declarationRowsFromSales(sales: readonly MyCampaignSalesMonth[]): readonly SalesAmountRow[] {
  return [...sales]
    .sort((left, right) => (left.period < right.period ? -1 : left.period > right.period ? 1 : 0))
    .map((month) => ({ period: month.period, amount: month.salesArs === null ? "" : String(month.salesArs) }));
}

/**
 * The «Completar con datos de ejemplo» filler: one simulated whole-ARS amount
 * per given month. Deterministic and never random, so the demo and its tests
 * are stable; the values are illustrative, not a projection of returns.
 */
export function sampleDeclaration(months: readonly string[]): readonly SalesAmountRow[] {
  return months.map((period, index) => ({
    period,
    amount: String(SAMPLE_BASE_ARS + index * SAMPLE_STEP_ARS)
  }));
}

/**
 * The months the declare form shows: the campaign's own declared months when it
 * has any, otherwise a demo window of `DEMO_DECLARE_WINDOW_MONTHS` ending the
 * month before the campaign deadline. The fallback is derived from persisted
 * data, never the wall clock (owner-pending: the template does not design the
 * declare form).
 */
export function declareMonthsFor(
  sales: readonly MyCampaignSalesMonth[],
  deadlineIso: string
): readonly string[] {
  if (sales.length > 0) {
    return [...sales]
      .map((month) => month.period)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  }

  const end = addMonths(deadlineIso.slice(0, 7), -1);
  return Array.from({ length: DEMO_DECLARE_WINDOW_MONTHS }, (_unused, index) =>
    addMonths(end, -(DEMO_DECLARE_WINDOW_MONTHS - 1 - index))
  );
}

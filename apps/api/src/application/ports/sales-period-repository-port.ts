/**
 * The persisted monthly sales series boundary (Feature #422, work unit WU2b).
 *
 * The campaign detail's "Evidencia de ventas" section reads
 * `public.business_sales_period`, and this port is the one write path that fills
 * it: the deterministic series a `SalesDataProviderPort` already serves for a
 * business, written once per `(business_id, period)`. Writing the provider's own
 * output — never a second, hand-rolled series — is what keeps the detail and the
 * PyME's sales feed in agreement by construction.
 *
 * The write is idempotent (`upsert` on the `(business_id, period)` primary key),
 * so both the business-creation path and the manual backfill
 * (`seed:sales-periods:docker|cloud`) can run it repeatedly without duplicating
 * or advancing anything.
 *
 * Plain data only: this port lives in `application/` and imports no Supabase or
 * Stellar SDK. `salesArs` is a `bigint` (the column is `bigint`) and is `null`
 * for a `missing` month — never a `0`.
 */

export type SalesPeriodStatus = "reported" | "missing" | "anomalous";

export interface SalesPeriodRecord {
  /** `YYYY-MM`, the same period vocabulary the sales feed uses. */
  readonly period: string;
  /** Whole ARS, or `null` for a missing month (never a fabricated zero). */
  readonly salesArs: bigint | null;
  readonly status: SalesPeriodStatus;
  /** The datum's provenance, mirroring the feed's own `provenance`. */
  readonly source: string;
}

export type SalesPeriodRepositoryError = { readonly code: "unavailable" };

export type SalesPeriodRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SalesPeriodRepositoryError };

export interface SalesPeriodRepositoryPort {
  /**
   * Idempotently persists a business's monthly series: one row per
   * `(business_id, period)`, upserted so a re-run neither duplicates nor
   * advances the feed.
   */
  saveForBusiness(input: {
    readonly businessId: string;
    readonly periods: readonly SalesPeriodRecord[];
  }): Promise<SalesPeriodRepositoryResult<void>>;
}

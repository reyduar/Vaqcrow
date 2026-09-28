import type { SalesPeriodContract } from "@vaqcrow/contracts";

/**
 * The sales-data boundary (issue #83, `docs/planning/DEMO.md` §6
 * `SalesDataProvider`): where the monthly synthetic sales series enters the
 * application. Nothing source-specific crosses it — no fiscal API, no ERP
 * SDK, no database driver — so a real authorized source (DEMO.md: "fuentes
 * fiscales, bancarias, adquirentes o ERP autorizados") is one more
 * implementation of this interface, which is what "provider stays
 * replaceable" means concretely.
 *
 * Plain data only: this port lives in `application/` and must not import
 * Fastify, Supabase, Stellar or LLM SDKs (`.dependency-cruiser.cjs`
 * `api-application-stays-provider-free`); the contract type below is the one
 * permitted type-only dependency.
 */

/**
 * Provider failures close to two sanitized codes, mirroring the assessment
 * and repository ports: an unknown business is `not_found`; anything else —
 * including every internal fault of a concrete provider — collapses to
 * `unavailable`. Internal detail is logged server-side by the adapter and
 * never crosses this boundary.
 */
export type SalesDataProviderErrorCode = "not_found" | "unavailable";

export interface SalesDataProviderError {
  readonly code: SalesDataProviderErrorCode;
}

export type SalesDataProviderResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SalesDataProviderError };

export interface RecordedSalesPeriodOutcome {
  readonly period: SalesPeriodContract;
  // false = idempotent replay: the next period had already been recorded.
  // Same semantics as ApplicationReviewTransitionOutcome.applied.
  readonly applied: boolean;
}

export interface SalesDataProviderPort {
  /**
   * The sales series for a business: the historical periods, plus the feed
   * period once it has been recorded through `recordNextPeriod`.
   */
  getPeriods(businessId: string): Promise<SalesDataProviderResult<readonly SalesPeriodContract[]>>;

  /**
   * Records the next period of the feed. Idempotent: the first call applies
   * the period (`applied: true`); every later call for the same business
   * returns the identical period with `applied: false` instead of advancing
   * the feed or duplicating it.
   */
  recordNextPeriod(businessId: string): Promise<SalesDataProviderResult<RecordedSalesPeriodOutcome>>;
}

import type { SalesPeriodContract } from "@vaqcrow/contracts";
import type {
  RecordedSalesPeriodOutcome,
  SalesDataProviderPort,
  SalesDataProviderResult
} from "../../application/ports/sales-data-provider-port.js";
import {
  DEMO_BUSINESS_ID,
  HISTORICAL_SALES_PERIODS,
  NEXT_SALES_PERIOD,
  SME_REFERENCE_TO_BUSINESS_ID
} from "./simulated-sales-dataset.js";

/**
 * The sales-data provider the demo runs on: frozen constants, no I/O, no
 * clock, no randomness — the same simulated-provider pattern as
 * `packages/ai/src/simulated-assessment-provider.ts`, and honest about it:
 * every datum it serves carries `simuladoLabel: "SIMULADO"` and its own
 * Spanish provenance, so nothing downstream can pass the feed for real
 * fiscal or ERP data.
 *
 * There is no internal failure mode to sanitize here (nothing is read,
 * nothing is parsed); the `failWith` option exists so route-level tests can
 * exercise the sanitized `unavailable` path the port guarantees, mirroring
 * the assessment provider's simulated failures.
 */

export type SimulatedSalesDataProviderOptions = {
  /** Simulate a provider-side failure instead of answering. */
  readonly failWith?: "unavailable";
};

/**
 * Accepts either the business id or a synthetic SME reference and returns the
 * business id, or `undefined` when the feed knows neither. `Object.hasOwn`
 * keeps inherited keys (`constructor`, `__proto__`) from resolving.
 */
function resolveBusinessId(identifier: string): string | undefined {
  if (identifier === DEMO_BUSINESS_ID) {
    return DEMO_BUSINESS_ID;
  }
  return Object.hasOwn(SME_REFERENCE_TO_BUSINESS_ID, identifier)
    ? SME_REFERENCE_TO_BUSINESS_ID[identifier]
    : undefined;
}

export function createSimulatedSalesDataProvider(
  options: SimulatedSalesDataProviderOptions = {}
): SalesDataProviderPort {
  // Recording state is in-memory per process (decision D2): a restart resets
  // the feed to "next period not yet recorded". No money fact depends on it.
  let recorded = false;

  const unavailable = (): SalesDataProviderResult<never> => ({
    ok: false,
    error: { code: "unavailable" }
  });

  const notFound = (): SalesDataProviderResult<never> => ({
    ok: false,
    error: { code: "not_found" }
  });

  return {
    async getPeriods(
      businessId: string
    ): Promise<SalesDataProviderResult<readonly SalesPeriodContract[]>> {
      if (options.failWith !== undefined) {
        return unavailable();
      }
      if (resolveBusinessId(businessId) !== DEMO_BUSINESS_ID) {
        return notFound();
      }
      return {
        ok: true,
        value: recorded ? [...HISTORICAL_SALES_PERIODS, NEXT_SALES_PERIOD] : HISTORICAL_SALES_PERIODS
      };
    },

    async recordNextPeriod(
      businessId: string
    ): Promise<SalesDataProviderResult<RecordedSalesPeriodOutcome>> {
      if (options.failWith !== undefined) {
        return unavailable();
      }
      if (resolveBusinessId(businessId) !== DEMO_BUSINESS_ID) {
        return notFound();
      }
      // Idempotent: the first call applies the frozen next period; every
      // replay returns the identical period marked `applied: false`, the
      // same replay semantics the review repository port established.
      const applied = !recorded;
      recorded = true;
      return { ok: true, value: { period: NEXT_SALES_PERIOD, applied } };
    }
  };
}

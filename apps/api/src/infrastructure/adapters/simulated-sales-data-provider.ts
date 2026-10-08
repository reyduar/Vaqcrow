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
import { isWellFormedSalesReference, synthesizeSalesSeries } from "./simulated-sales-synthesizer.js";

/**
 * The sales-data provider the demo runs on: frozen constants for the demo
 * business plus a deterministic synthetic series for any other well-formed
 * reference (U11), no I/O, no clock, no randomness — the same simulated-provider pattern as
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
 * The series one identifier resolves to: `key` names the in-memory recording
 * slot. The demo business id and its synthetic SME reference share the frozen
 * dataset (and one slot); any other well-formed reference — a wizard CUIT, for
 * instance (U11) — gets its deterministic synthetic series. `Object.hasOwn`
 * keeps inherited keys (`constructor`, `__proto__`) from resolving to the
 * frozen dataset; a malformed identifier resolves to nothing (`not_found`).
 */
interface ResolvedSeries {
  readonly key: string;
  readonly historical: readonly SalesPeriodContract[];
  readonly next: SalesPeriodContract;
}

function resolveSeries(identifier: string): ResolvedSeries | undefined {
  const isDemo =
    identifier === DEMO_BUSINESS_ID ||
    (Object.hasOwn(SME_REFERENCE_TO_BUSINESS_ID, identifier) &&
      SME_REFERENCE_TO_BUSINESS_ID[identifier] === DEMO_BUSINESS_ID);

  if (isDemo) {
    return { key: DEMO_BUSINESS_ID, historical: HISTORICAL_SALES_PERIODS, next: NEXT_SALES_PERIOD };
  }

  if (!isWellFormedSalesReference(identifier)) {
    return undefined;
  }

  return { key: `synthetic:${identifier}`, ...synthesizeSalesSeries(identifier) };
}

export function createSimulatedSalesDataProvider(
  options: SimulatedSalesDataProviderOptions = {}
): SalesDataProviderPort {
  // Recording state is in-memory per process (decision D2): a restart resets
  // the feed to "next period not yet recorded". No money fact depends on it.
  const recorded = new Set<string>();

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
      const series = resolveSeries(businessId);
      if (series === undefined) {
        return notFound();
      }
      return {
        ok: true,
        value: recorded.has(series.key) ? [...series.historical, series.next] : series.historical
      };
    },

    async recordNextPeriod(
      businessId: string
    ): Promise<SalesDataProviderResult<RecordedSalesPeriodOutcome>> {
      if (options.failWith !== undefined) {
        return unavailable();
      }
      const series = resolveSeries(businessId);
      if (series === undefined) {
        return notFound();
      }
      // Idempotent: the first call applies the next period; every replay
      // returns the identical period marked `applied: false`, the same replay
      // semantics the review repository port established.
      const applied = !recorded.has(series.key);
      recorded.add(series.key);
      return { ok: true, value: { period: series.next, applied } };
    }
  };
}

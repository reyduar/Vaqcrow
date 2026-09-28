import { HISTORICAL_SALES_PERIODS } from "../apps/api/src/infrastructure/adapters/simulated-sales-dataset.js";
import { panaderiaHorizonte } from "../apps/web/src/application/fixtures/panaderia-horizonte.js";

export interface ComparableSalesPeriod {
  readonly period: string;
  readonly amountArs: number | null;
  readonly status: "reported" | "missing" | "anomalous";
  readonly provenance: string | undefined;
  readonly evidenceRef: string;
  readonly simuladoLabel: "SIMULADO";
}

interface ComparableSalesPeriodInput extends Omit<ComparableSalesPeriod, "provenance"> {
  readonly provenance?: string | undefined;
}

function comparablePeriod(period: ComparableSalesPeriodInput): ComparableSalesPeriod {
  return {
    period: period.period,
    amountArs: period.amountArs,
    status: period.status,
    provenance: period.provenance,
    evidenceRef: period.evidenceRef,
    simuladoLabel: period.simuladoLabel
  };
}

/**
 * Test-only guard for the deliberately duplicated historical data. It is kept
 * under the root test harness so neither application gains a runtime import of
 * the other.
 */
export function buildMonthlySalesFeedParitySnapshot(): {
  readonly apiPeriods: readonly ComparableSalesPeriod[];
  readonly webPeriods: readonly ComparableSalesPeriod[];
} {
  return {
    apiPeriods: HISTORICAL_SALES_PERIODS.map(comparablePeriod),
    webPeriods: panaderiaHorizonte.sales.map(comparablePeriod)
  };
}

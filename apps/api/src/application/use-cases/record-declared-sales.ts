import type { DeclaredSalesPeriod } from "@vaqcrow/contracts";
import type {
  SalesPeriodRecord,
  SalesPeriodRepositoryPort,
  SalesPeriodRepositoryResult,
  SalesPeriodStatus
} from "../ports/sales-period-repository-port.js";

/**
 * The PyME's declared monthly sales (Feature #434, WU1b).
 *
 * The declaration path lets a PyME submit its own amounts for one or more
 * months, alongside the simulated demo provider that keeps serving the demo
 * business. Both write the SAME persisted shape (`business_sales_period`,
 * Feature #422/WU2b), so the campaign detail and the sales feed never diverge
 * regardless of which path filled a given month. A declared row is marked with
 * `DECLARED_SALES_SOURCE` in `source`, distinguishing it from the simulated
 * provenance without inventing a second table or column.
 *
 * `salesArs === null` is a missing month (`status: "missing"`, stored as SQL
 * `NULL`) — an absence, never a fabricated `0`, per the table's check constraint
 * `(sales_ars is null) = (status = 'missing')`.
 *
 * Anomaly rule (deterministic, documented): the declared months are ordered by
 * `period` ascending; for each month with an amount, the trailing average is the
 * mean of the amounts of the *preceding* reported months (missing months and
 * their gaps are skipped). A month is `anomalous` when its amount is at or above
 * `ANOMALY_FACTOR` times that average, or at or below the average divided by
 * `ANOMALY_FACTOR`. The first reported month has no baseline and is always
 * `reported`. No clock, no randomness: the same declared set always classifies
 * the same way.
 */

/** The `source` every declared row carries, marking it as a manual entry. */
export const DECLARED_SALES_SOURCE = "declared";

/** A month this far from its trailing average (either way) is `anomalous`. */
export const ANOMALY_FACTOR = 2;

/**
 * Classifies the declared periods into the persisted record shape, applying the
 * documented anomaly rule and ordering the output by `period` ascending.
 */
export function classifyDeclaredSalesPeriods(
  periods: readonly DeclaredSalesPeriod[]
): readonly SalesPeriodRecord[] {
  const ordered = [...periods].sort((left, right) =>
    left.period < right.period ? -1 : left.period > right.period ? 1 : 0
  );

  // The trailing baseline: the amount of every preceding reported month.
  const precedingAmounts: number[] = [];
  let precedingTotal = 0;

  return ordered.map((entry) => {
    if (entry.salesArs === null) {
      return {
        period: entry.period,
        salesArs: null,
        status: "missing" as const,
        source: DECLARED_SALES_SOURCE
      };
    }

    let status: SalesPeriodStatus = "reported";
    if (precedingAmounts.length > 0) {
      const trailingAverage = precedingTotal / precedingAmounts.length;
      if (
        entry.salesArs >= ANOMALY_FACTOR * trailingAverage ||
        entry.salesArs * ANOMALY_FACTOR <= trailingAverage
      ) {
        status = "anomalous";
      }
    }

    precedingAmounts.push(entry.salesArs);
    precedingTotal += entry.salesArs;

    return {
      period: entry.period,
      salesArs: BigInt(entry.salesArs),
      status,
      source: DECLARED_SALES_SOURCE
    };
  });
}

export interface RecordDeclaredSalesInput {
  readonly businessId: string;
  readonly periods: readonly DeclaredSalesPeriod[];
}

/**
 * Persists a PyME's declared months through the shared sales-period port,
 * returning the records as written. A persistence failure collapses to the
 * port's sanitized `unavailable`.
 */
export class RecordDeclaredSales {
  constructor(
    private readonly repository: Pick<SalesPeriodRepositoryPort, "saveForBusiness">
  ) {}

  async execute(
    input: RecordDeclaredSalesInput
  ): Promise<SalesPeriodRepositoryResult<readonly SalesPeriodRecord[]>> {
    const records = classifyDeclaredSalesPeriods(input.periods);
    const saved = await this.repository.saveForBusiness({
      businessId: input.businessId,
      periods: records
    });

    if (!saved.ok) {
      return saved;
    }

    return { ok: true, value: records };
  }
}

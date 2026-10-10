import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalesPeriodContract } from "@vaqcrow/contracts";
import type {
  SalesPeriodRecord,
  SalesPeriodRepositoryPort,
  SalesPeriodRepositoryResult
} from "../../application/ports/sales-period-repository-port.js";

/**
 * The Supabase adapter for the persisted monthly sales series (#422/WU2b).
 *
 * The API connects as `service_role`, so the table's RLS is bypassed; the
 * migration grants `select`/`insert`/`update` to `service_role` only and leaves
 * the table with zero policies, so no other role can reach it. The write is an
 * `upsert` on the `(business_id, period)` primary key: replay-safe, and the
 * only writer of the two surfaces' shared series.
 *
 * Failures collapse to a sanitized `unavailable`; PostgREST's
 * `message`/`details`/`hint` are logged server-side and never cross this
 * boundary.
 */

const TABLE = "business_sales_period";

/**
 * Projects the sales feed's own contract into the persisted record. `source`
 * mirrors the feed's per-datum `provenance`; the synthetic provider always
 * populates it, and the fallback keeps a legacy payload honest with its
 * `SIMULADO` label. Amounts are whole ARS.
 */
export function toSalesPeriodRecords(periods: readonly SalesPeriodContract[]): readonly SalesPeriodRecord[] {
  return periods.map((period) => ({
    period: period.period,
    salesArs: period.amountArs === null ? null : BigInt(Math.round(period.amountArs)),
    status: period.status,
    source: period.provenance ?? period.simuladoLabel
  }));
}

export class SupabaseSalesPeriodRepository implements SalesPeriodRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async saveForBusiness(input: {
    readonly businessId: string;
    readonly periods: readonly SalesPeriodRecord[];
  }): Promise<SalesPeriodRepositoryResult<void>> {
    // An empty series is a no-op success: the business keeps whatever it has.
    if (input.periods.length === 0) return { ok: true, value: undefined };

    try {
      const rows = input.periods.map((period) => ({
        business_id: input.businessId,
        period: period.period,
        // PostgREST serializes JSON, so a `bigint` becomes a number: the demo's
        // ARS amounts are well within `Number.MAX_SAFE_INTEGER`.
        sales_ars: period.salesArs === null ? null : Number(period.salesArs),
        status: period.status,
        source: period.source
      }));

      const { error } = await this.client.from(TABLE).upsert(rows, { onConflict: "business_id,period" });

      if (error) {
        // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
        console.error("[SupabaseSalesPeriodRepository] persistence error", { code: error.code });
        return { ok: false, error: { code: "unavailable" } };
      }

      return { ok: true, value: undefined };
    } catch (error) {
      // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
      console.error("[SupabaseSalesPeriodRepository] unexpected error", {
        name: error instanceof Error ? error.name : "unknown"
      });
      return { ok: false, error: { code: "unavailable" } };
    }
  }
}

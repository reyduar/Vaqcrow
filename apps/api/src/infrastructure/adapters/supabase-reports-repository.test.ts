import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseReportsRepository } from "./supabase-reports-repository.js";

/**
 * The investor report read adapter (#430, WU1). It reads the three
 * service_role-only views, filters by the resolved investor account, and maps
 * PostgREST's text/numeric columns back to typed records. A malformed row or a
 * provider error is `unavailable`; the provider's message/details/hint and any
 * private path never reach the caller.
 */
const ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const C1 = "123e4567-e89b-42d3-a456-426614174000";

const CONTRIBUTION_ROW = {
  investor_account_id: ACCOUNT,
  campaign_id: C1,
  contribution_stroops: "1500000",
  observed_at: "2026-03-01T00:00:00+00:00"
};

const DISTRIBUTION_ROW = {
  investor_account_id: ACCOUNT,
  distribution_id: "d1000000-0000-4000-8000-000000000001",
  campaign_id: C1,
  campaign_name: "Panadería Sol",
  period: "2026-06",
  amount_stroops: "12500000",
  state: "confirmed",
  confirmed_at: "2026-07-01T00:00:00+00:00",
  recorded_at: "2026-06-30T00:00:00+00:00",
  declared_sales_ars: "9000000"
};

const SALES_ROW = {
  investor_account_id: ACCOUNT,
  campaign_id: C1,
  name: "Panadería Sol",
  sector: "Alimentos",
  period: "2026-06",
  sales_ars: "9000000",
  status: "reported"
};

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

function fakeClient(perTable: Record<string, FakeStep>): {
  client: SupabaseClient;
  from: string[];
  eq: Array<readonly [string, unknown]>;
  order: Array<readonly [string, unknown]>;
} {
  const from: string[] = [];
  const eq: Array<readonly [string, unknown]> = [];
  const order: Array<readonly [string, unknown]> = [];
  const client = {
    from: (table: string) => {
      from.push(table);
      const step = perTable[table] ?? { data: [] };
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          eq.push([column, value]);
          return builder;
        },
        order: (column: string, options: unknown) => {
          order.push([column, options]);
          return builder;
        },
        then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
          const settled = step.reject
            ? Promise.reject(step.reject)
            : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });
          return settled.then(onFulfilled, onRejected);
        }
      };
      return builder;
    }
  } as unknown as SupabaseClient;
  return { client, from, eq, order };
}

describe("SupabaseReportsRepository", () => {
  it("reads the contributions view scoped by the investor account", async () => {
    const { client, from, eq, order } = fakeClient({ investor_report_contribution: { data: [CONTRIBUTION_ROW] } });

    const result = await new SupabaseReportsRepository(client).listContributions(ACCOUNT);

    expect(from).toEqual(["investor_report_contribution"]);
    expect(eq).toEqual([["investor_account_id", ACCOUNT]]);
    expect(order).toEqual([["observed_at", { ascending: true }]]);
    expect(result).toEqual({
      ok: true,
      value: [{ campaignId: C1, contributionStroops: 1_500_000n, observedAt: "2026-03-01T00:00:00+00:00" }]
    });
  });

  it("reads the distributions view scoped by the investor account, newest first", async () => {
    const { client, from, eq, order } = fakeClient({ investor_report_distribution: { data: [DISTRIBUTION_ROW] } });

    const result = await new SupabaseReportsRepository(client).listDistributions(ACCOUNT);

    expect(from).toEqual(["investor_report_distribution"]);
    expect(eq).toEqual([["investor_account_id", ACCOUNT]]);
    expect(order).toEqual([["recorded_at", { ascending: false }]]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          distributionId: "d1000000-0000-4000-8000-000000000001",
          campaignId: C1,
          campaignName: "Panadería Sol",
          period: "2026-06",
          amountStroops: 12_500_000n,
          state: "confirmed",
          confirmedAt: "2026-07-01T00:00:00+00:00",
          recordedAt: "2026-06-30T00:00:00+00:00",
          declaredSalesArs: 9_000_000n
        }
      ]
    });
  });

  it("maps a legacy distribution with no campaign, period, confirmation or declared sale to nulls", async () => {
    const legacy = {
      ...DISTRIBUTION_ROW,
      campaign_id: null,
      campaign_name: null,
      period: null,
      state: "submitted",
      confirmed_at: null,
      declared_sales_ars: null
    };
    const { client } = fakeClient({ investor_report_distribution: { data: [legacy] } });

    const result = await new SupabaseReportsRepository(client).listDistributions(ACCOUNT);

    expect(result.ok && result.value[0]).toEqual({
      distributionId: "d1000000-0000-4000-8000-000000000001",
      campaignId: null,
      campaignName: null,
      period: null,
      amountStroops: 12_500_000n,
      state: "submitted",
      confirmedAt: null,
      recordedAt: "2026-06-30T00:00:00+00:00",
      declaredSalesArs: null
    });
  });

  it("reads the sales-by-pyme view scoped by the investor account", async () => {
    const { client, from, eq, order } = fakeClient({ investor_report_sales_by_pyme: { data: [SALES_ROW] } });

    const result = await new SupabaseReportsRepository(client).listSalesByPyme(ACCOUNT);

    expect(from).toEqual(["investor_report_sales_by_pyme"]);
    expect(eq).toEqual([["investor_account_id", ACCOUNT]]);
    expect(order).toEqual([
      ["name", { ascending: true }],
      ["period", { ascending: true }]
    ]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          campaignId: C1,
          name: "Panadería Sol",
          sector: "Alimentos",
          period: "2026-06",
          salesArs: 9_000_000n,
          status: "reported"
        }
      ]
    });
  });

  it("maps a missing month to a null sale and refuses an unknown status", async () => {
    const missing = { ...SALES_ROW, sales_ars: null, status: "missing" };
    const { client } = fakeClient({ investor_report_sales_by_pyme: { data: [missing] } });

    const result = await new SupabaseReportsRepository(client).listSalesByPyme(ACCOUNT);
    expect(result.ok && result.value[0]?.salesArs).toBeNull();

    const bad = fakeClient({ investor_report_sales_by_pyme: { data: [{ ...SALES_ROW, status: "partial" }] } });
    expect(await new SupabaseReportsRepository(bad.client).listSalesByPyme(ACCOUNT)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("reports unavailable on a provider error, never leaking its text", async () => {
    const { client } = fakeClient({
      investor_report_contribution: { error: { code: "PGRST500", message: "secret detail", details: "d", hint: "h" } }
    });

    const result = await new SupabaseReportsRepository(client).listContributions(ACCOUNT);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("secret detail");
  });

  it("reports unavailable on a malformed row, state or non-array payload", async () => {
    const badState = fakeClient({ investor_report_distribution: { data: [{ ...DISTRIBUTION_ROW, state: "bogus" }] } });
    const notArray = fakeClient({ investor_report_sales_by_pyme: { data: { not: "an array" } } });

    expect(await new SupabaseReportsRepository(badState.client).listDistributions(ACCOUNT)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    expect(await new SupabaseReportsRepository(notArray.client).listSalesByPyme(ACCOUNT)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

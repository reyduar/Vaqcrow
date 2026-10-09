import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalesPeriodContract } from "@vaqcrow/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SupabaseSalesPeriodRepository,
  toSalesPeriodRecords
} from "./supabase-sales-period-repository.js";

/**
 * The Supabase adapter for `business_sales_period` (#422/WU2b, reused by the
 * declared path #434/WU1b).
 *
 * The adapter maps whole-ARS amounts to `bigint` (posting a JSON number) and a
 * missing month to SQL `NULL` — never `0` — through an `upsert` on
 * `(business_id, period)`. Failures collapse to a sanitized `unavailable`,
 * while PostgREST's message/details/hint and the raw exception stay
 * server-side. This file characterizes that contract; the adapter itself is
 * unchanged by #434/WU1b, so there is no behavioral RED to capture here.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function fakeClient(upsert: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient;
}

describe("toSalesPeriodRecords", () => {
  const withProvenance: SalesPeriodContract = {
    period: "2026-01",
    amountArs: 3_150_000,
    status: "reported",
    provenance: "Declaración manual",
    evidenceRef: "sales:2026-01",
    simuladoLabel: "SIMULADO"
  };

  it("maps a reported period, keeping the feed's provenance as source", () => {
    expect(toSalesPeriodRecords([withProvenance])).toEqual([
      { period: "2026-01", salesArs: 3_150_000n, status: "reported", source: "Declaración manual" }
    ]);
  });

  it("maps a null amount to a null bigint (never 0) and falls back to the SIMULADO label", () => {
    const missing: SalesPeriodContract = {
      period: "2026-04",
      amountArs: null,
      status: "missing",
      evidenceRef: "missing:2026-04",
      simuladoLabel: "SIMULADO"
    };

    expect(toSalesPeriodRecords([missing])).toEqual([
      { period: "2026-04", salesArs: null, status: "missing", source: "SIMULADO" }
    ]);
  });
});

describe("SupabaseSalesPeriodRepository.saveForBusiness", () => {
  it("upserts one row per period on (business_id, period) with the declared source", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const repository = new SupabaseSalesPeriodRepository(fakeClient(upsert));

    const result = await repository.saveForBusiness({
      businessId: "panaderia-horizonte",
      periods: [
        { period: "2026-01", salesArs: 100n, status: "reported", source: "declared" },
        { period: "2026-02", salesArs: null, status: "missing", source: "declared" }
      ]
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(upsert).toHaveBeenCalledTimes(1);
    const [rows, options] = upsert.mock.calls[0] as [unknown, { onConflict: string }];
    expect(options).toEqual({ onConflict: "business_id,period" });
    expect(rows).toEqual([
      { business_id: "panaderia-horizonte", period: "2026-01", sales_ars: 100, status: "reported", source: "declared" },
      { business_id: "panaderia-horizonte", period: "2026-02", sales_ars: null, status: "missing", source: "declared" }
    ]);
  });

  it("is a no-op success for an empty series", async () => {
    const upsert = vi.fn();
    const repository = new SupabaseSalesPeriodRepository(fakeClient(upsert));

    const result = await repository.saveForBusiness({ businessId: "panaderia-horizonte", periods: [] });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("collapses a PostgREST error to a sanitized unavailable without leaking detail", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const upsert = vi.fn().mockResolvedValue({
      error: { code: "23514", message: "check constraint", details: "internal", hint: "internal" }
    });
    const repository = new SupabaseSalesPeriodRepository(fakeClient(upsert));

    const result = await repository.saveForBusiness({
      businessId: "panaderia-horizonte",
      periods: [{ period: "2026-01", salesArs: 1n, status: "reported", source: "declared" }]
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("23514");
  });

  it("collapses a thrown exception to a sanitized unavailable", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const upsert = vi.fn().mockRejectedValue(new Error("connection reset by peer"));
    const repository = new SupabaseSalesPeriodRepository(fakeClient(upsert));

    const result = await repository.saveForBusiness({
      businessId: "panaderia-horizonte",
      periods: [{ period: "2026-01", salesArs: 1n, status: "reported", source: "declared" }]
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("connection reset");
  });
});

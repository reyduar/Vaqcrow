import type { DeclaredSalesPeriod } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { SalesPeriodRecord } from "../ports/sales-period-repository-port.js";
import {
  ANOMALY_FACTOR,
  DECLARED_SALES_SOURCE,
  RecordDeclaredSales,
  classifyDeclaredSalesPeriods
} from "./record-declared-sales.js";

/**
 * The declared-sales use case (Feature #434, WU1b).
 *
 * The PyME's own monthly amounts take the same persisted shape the simulated
 * feed writes (`business_sales_period`), so the two sources never diverge:
 * `status` is `missing` for a null amount (never 0), `reported` normally, and
 * `anomalous` when a month deviates past a documented factor from the trailing
 * average of the preceding reported months. The rule is deterministic: same
 * input, same output, no clock and no randomness.
 */

describe("classifyDeclaredSalesPeriods", () => {
  it("marks a lone reported month as reported", () => {
    const result = classifyDeclaredSalesPeriods([{ period: "2026-01", salesArs: 3_150_000 }]);

    expect(result).toEqual([
      { period: "2026-01", salesArs: 3_150_000n, status: "reported", source: DECLARED_SALES_SOURCE }
    ]);
  });

  it("marks a null amount as missing with a null figure (never 0)", () => {
    const result = classifyDeclaredSalesPeriods([{ period: "2026-04", salesArs: null }]);

    expect(result).toEqual([{ period: "2026-04", salesArs: null, status: "missing", source: DECLARED_SALES_SOURCE }]);
  });

  it("flags a month at or above twice the trailing average as anomalous", () => {
    const result = classifyDeclaredSalesPeriods([
      { period: "2026-01", salesArs: 100 },
      { period: "2026-02", salesArs: 200 }
    ]);

    expect(result.map((record) => record.status)).toEqual(["reported", "anomalous"]);
  });

  it("flags a month at or below half the trailing average as anomalous", () => {
    const result = classifyDeclaredSalesPeriods([
      { period: "2026-01", salesArs: 100 },
      { period: "2026-02", salesArs: 50 }
    ]);

    expect(result.map((record) => record.status)).toEqual(["reported", "anomalous"]);
  });

  it("keeps a month just inside the factor as reported", () => {
    const result = classifyDeclaredSalesPeriods([
      { period: "2026-01", salesArs: 100 },
      { period: "2026-02", salesArs: 190 }
    ]);

    expect(result.map((record) => record.status)).toEqual(["reported", "reported"]);
  });

  it("averages only the preceding reported months, skipping a missing one", () => {
    const result = classifyDeclaredSalesPeriods([
      { period: "2026-01", salesArs: 100 },
      { period: "2026-02", salesArs: null },
      { period: "2026-03", salesArs: 300 }
    ]);

    expect(result.map((record) => record.status)).toEqual(["reported", "missing", "anomalous"]);
    expect(result[1]).toEqual({ period: "2026-02", salesArs: null, status: "missing", source: DECLARED_SALES_SOURCE });
  });

  it("orders the declared months by period before applying the rule", () => {
    const result = classifyDeclaredSalesPeriods([
      { period: "2026-03", salesArs: 300 },
      { period: "2026-01", salesArs: 100 },
      { period: "2026-02", salesArs: 120 }
    ]);

    expect(result.map((record) => record.period)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(result.map((record) => record.status)).toEqual(["reported", "reported", "anomalous"]);
  });

  it("documents the anomaly factor as a named constant", () => {
    expect(ANOMALY_FACTOR).toBe(2);
  });
});

describe("RecordDeclaredSales", () => {
  const PERIODS: readonly DeclaredSalesPeriod[] = [
    { period: "2026-01", salesArs: 100 },
    { period: "2026-02", salesArs: null }
  ];

  function repository(result: { ok: true } | { ok: false }) {
    return {
      saveForBusiness: vi.fn().mockResolvedValue(
        result.ok ? { ok: true, value: undefined } : { ok: false, error: { code: "unavailable" } }
      )
    };
  }

  it("classifies, persists and returns the persisted records", async () => {
    const repo = repository({ ok: true });

    const outcome = await new RecordDeclaredSales(repo).execute({
      businessId: "panaderia-horizonte",
      periods: PERIODS
    });

    expect(repo.saveForBusiness).toHaveBeenCalledTimes(1);
    const saved = repo.saveForBusiness.mock.calls.at(0)?.at(0) as {
      businessId: string;
      periods: readonly SalesPeriodRecord[];
    };
    expect(saved.businessId).toBe("panaderia-horizonte");
    expect(saved.periods).toHaveLength(2);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value).toEqual(saved.periods);
      expect(outcome.value[1]?.status).toBe("missing");
    }
  });

  it("propagates a sanitized unavailable when persistence fails", async () => {
    const repo = repository({ ok: false });

    const outcome = await new RecordDeclaredSales(repo).execute({
      businessId: "panaderia-horizonte",
      periods: PERIODS
    });

    expect(outcome).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

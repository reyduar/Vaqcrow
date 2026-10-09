import { describe, expect, it } from "vitest";
import type { MyCampaignSalesMonth } from "@/application/ports/my-campaigns-port";
import {
  buildDeclaredPeriods,
  declarationRowsFromSales,
  declareMonthsFor,
  DEMO_DECLARE_WINDOW_MONTHS,
  parseSalesAmount,
  sampleDeclaration,
  type SalesAmountRow
} from "./sales-declaration";

const sales = (months: readonly (readonly [string, number | null])[]): MyCampaignSalesMonth[] =>
  months.map(([period, salesArs]) => ({
    period,
    salesArs,
    status: salesArs === null ? "missing" : "reported"
  }));

describe("parseSalesAmount", () => {
  it("treats an empty or whitespace-only input as a missing month (null)", () => {
    expect(parseSalesAmount("")).toBeNull();
    expect(parseSalesAmount("   ")).toBeNull();
  });

  it("parses a whole non-negative amount", () => {
    expect(parseSalesAmount("0")).toBe(0);
    expect(parseSalesAmount("1500")).toBe(1500);
    expect(parseSalesAmount("007")).toBe(7);
  });

  it("rejects anything that is not a whole non-negative integer", () => {
    expect(parseSalesAmount("-1")).toBeUndefined();
    expect(parseSalesAmount("1.5")).toBeUndefined();
    expect(parseSalesAmount("1.000")).toBeUndefined();
    expect(parseSalesAmount("1 500")).toBeUndefined();
    expect(parseSalesAmount("abc")).toBeUndefined();
    expect(parseSalesAmount("1e6")).toBeUndefined();
  });

  it("rejects a value a JavaScript number cannot carry exactly", () => {
    expect(parseSalesAmount("9007199254740993")).toBeUndefined();
  });
});

describe("buildDeclaredPeriods", () => {
  const row = (period: string, amount: string): SalesAmountRow => ({ period, amount });

  it("builds the declared periods, keeping an empty amount as null (never 0)", () => {
    const result = buildDeclaredPeriods([
      row("2026-01", "1850000"),
      row("2026-02", ""),
      row("2026-03", "0")
    ]);

    expect(result).toEqual({
      ok: true,
      periods: [
        { period: "2026-01", salesArs: 1_850_000 },
        { period: "2026-02", salesArs: null },
        { period: "2026-03", salesArs: 0 }
      ]
    });
  });

  it("refuses an empty form", () => {
    expect(buildDeclaredPeriods([])).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses an invalid period", () => {
    expect(buildDeclaredPeriods([row("2026-13", "10")])).toEqual({
      ok: false,
      reason: "invalid_period"
    });
    expect(buildDeclaredPeriods([row("enero", "10")])).toEqual({
      ok: false,
      reason: "invalid_period"
    });
  });

  it("refuses an invalid amount", () => {
    expect(buildDeclaredPeriods([row("2026-01", "mil")])).toEqual({
      ok: false,
      reason: "invalid_amount"
    });
  });
});

describe("declarationRowsFromSales", () => {
  it("pre-fills the form from the declared months, oldest first, null as empty", () => {
    const rows = declarationRowsFromSales(
      sales([
        ["2026-03", 900_000],
        ["2026-01", 1_850_000],
        ["2026-02", null]
      ])
    );

    expect(rows).toEqual([
      { period: "2026-01", amount: "1850000" },
      { period: "2026-02", amount: "" },
      { period: "2026-03", amount: "900000" }
    ]);
  });

  it("returns no rows without declared months", () => {
    expect(declarationRowsFromSales([])).toEqual([]);
  });
});

describe("sampleDeclaration", () => {
  it("fills every given month with a deterministic whole-ARS sample", () => {
    const first = sampleDeclaration(["2026-01", "2026-02", "2026-03"]);
    const second = sampleDeclaration(["2026-01", "2026-02", "2026-03"]);

    expect(first).toEqual(second);
    expect(first.map((entry) => entry.period)).toEqual(["2026-01", "2026-02", "2026-03"]);
    for (const entry of first) {
      expect(parseSalesAmount(entry.amount)).not.toBeUndefined();
      expect(parseSalesAmount(entry.amount)).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the sample distinct from an empty month", () => {
    expect(sampleDeclaration(["2026-01"])[0]?.amount).not.toBe("");
  });
});

describe("declareMonthsFor", () => {
  it("uses the campaign's own declared months, oldest first", () => {
    const months = declareMonthsFor(
      sales([
        ["2026-03", 1],
        ["2026-01", 2]
      ]),
      "2026-11-30T12:00:00.000Z"
    );

    expect(months).toEqual(["2026-01", "2026-03"]);
  });

  it("falls back to a demo window ending the month before the deadline", () => {
    const months = declareMonthsFor([], "2026-11-30T12:00:00.000Z");

    expect(months).toHaveLength(DEMO_DECLARE_WINDOW_MONTHS);
    expect(months[months.length - 1]).toBe("2026-10");
    expect(months[0]).toBe("2026-03");
  });
});

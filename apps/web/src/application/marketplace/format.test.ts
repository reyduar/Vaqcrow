import { describe, expect, it } from "vitest";
import {
  formatArsAmount,
  formatCloseDate,
  formatFundedPercentLabel,
  formatRevenueSharePercent,
  fundedPercent
} from "./format";

describe("formatArsAmount", () => {
  it("renders whole pesos with es-AR thousands separators", () => {
    expect(formatArsAmount(9_450_000)).toBe("ARS 9.450.000");
    expect(formatArsAmount(1_000)).toBe("ARS 1.000");
    expect(formatArsAmount(0)).toBe("ARS 0");
  });
});

describe("formatCloseDate", () => {
  it("renders day/month/year with es-AR formatting", () => {
    expect(formatCloseDate("2026-11-30T12:00:00.000Z")).toBe("30/11/2026");
  });

  it("returns an empty string for an invalid date instead of inventing one", () => {
    expect(formatCloseDate("not-a-date")).toBe("");
  });
});

describe("fundedPercent", () => {
  it("rounds basis points to a whole percent", () => {
    expect(fundedPercent(6_300)).toBe(63);
    expect(fundedPercent(6_350)).toBe(64);
    expect(fundedPercent(0)).toBe(0);
  });

  it("clamps to 0..100", () => {
    expect(fundedPercent(10_000)).toBe(100);
    expect(fundedPercent(12_000)).toBe(100);
    expect(fundedPercent(-50)).toBe(0);
  });
});

describe("formatFundedPercentLabel", () => {
  it("renders the percent of goal label", () => {
    expect(formatFundedPercentLabel(6_300)).toBe("63 % de la meta");
    expect(formatFundedPercentLabel(0)).toBe("0 % de la meta");
  });
});

describe("formatRevenueSharePercent", () => {
  it("renders up to two decimals with a comma", () => {
    expect(formatRevenueSharePercent(4.5)).toBe("4,5 % de ventas");
    expect(formatRevenueSharePercent(4)).toBe("4 % de ventas");
    expect(formatRevenueSharePercent(4.567)).toBe("4,57 % de ventas");
  });
});

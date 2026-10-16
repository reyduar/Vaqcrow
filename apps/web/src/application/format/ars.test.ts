import { describe, expect, it } from "vitest";
import { formatApproxArs, xlmToArs } from "./ars";

/**
 * The simulated ARS equivalent of an XLM balance (#572). Integer math only:
 * `stroops × usdToArs / (stroopsPerUsd × 1.000.000)`, the same conversion the
 * API's portfolio uses. An unknown balance or rate is `null`, never a zero.
 */
// 1.400 ARS per USD (scaled by 10^6) and 3 XLM per USD.
const RATE = { usdToArs: 1_400_000_000n, stroopsPerUsd: 30_000_000n };

describe("xlmToArs", () => {
  it("converts a dot-decimal XLM balance to whole ARS, truncating", () => {
    // 10.000,1234567 XLM = 100.001.234.567 stroops -> 4.666.724,6 ARS.
    expect(xlmToArs("10000.1234567", RATE)).toBe(4_666_724n);
  });

  it("converts a whole balance without decimals", () => {
    expect(xlmToArs("3", RATE)).toBe(1_400n);
  });

  it("is null without a rate or without a balance", () => {
    expect(xlmToArs("10", null)).toBeNull();
    expect(xlmToArs(null, RATE)).toBeNull();
  });

  it("is null for a balance that is not a plain non-negative decimal", () => {
    expect(xlmToArs("1e3", RATE)).toBeNull();
    expect(xlmToArs("-1", RATE)).toBeNull();
    expect(xlmToArs("1.12345678", RATE)).toBeNull();
  });

  it("is null for a rate that cannot convert (zero stroops per USD)", () => {
    expect(xlmToArs("10", { usdToArs: 1n, stroopsPerUsd: 0n })).toBeNull();
  });
});

describe("formatApproxArs", () => {
  it("renders whole ARS in es-AR, marked as approximate", () => {
    expect(formatApproxArs(4_666_724n)).toBe("≈ ARS 4.666.724");
  });
});

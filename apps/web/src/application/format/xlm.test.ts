import { describe, expect, it } from "vitest";
import { formatXlmAmount, formatXlmValue } from "./xlm";

/**
 * The single XLM display formatter (#572): every XLM amount the UI shows reads
 * with exactly 2 decimals in `es-AR`. The signing review keeps the exact
 * amount through `formatStroopsAsXlm`, which this module never replaces.
 */
describe("formatXlmAmount", () => {
  it("renders a canonical 7-decimal XLM with 2 decimals and the unit", () => {
    expect(formatXlmAmount("10000.1234567")).toBe("10.000,12 XLM");
  });

  it("rounds the third decimal half up, as Intl does", () => {
    expect(formatXlmAmount("9998.3398722")).toBe("9.998,34 XLM");
  });

  it("pads a whole amount to 2 decimals", () => {
    expect(formatXlmAmount("20.0000000")).toBe("20,00 XLM");
  });

  it("returns a non-numeric input unchanged rather than inventing a number", () => {
    expect(formatXlmAmount("n/a")).toBe("n/a");
  });
});

describe("formatXlmValue", () => {
  it("renders 2 decimals without the unit", () => {
    expect(formatXlmValue("1250.5000000")).toBe("1.250,50");
  });
});

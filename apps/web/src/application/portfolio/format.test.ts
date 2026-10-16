import { describe, expect, it } from "vitest";
import { formatXlmAmount } from "./format";

describe("formatXlmAmount", () => {
  it("formats canonical XLM in es-AR with exactly 2 fraction digits (#572)", () => {
    expect(formatXlmAmount("1250.0000000")).toBe("1.250,00 XLM");
  });

  it("keeps trailing zeros so the stroop precision is visible", () => {
    expect(formatXlmAmount("4.1200000")).toBe("4,12 XLM");
  });

  it("does not turn a null stand-in into a zero", () => {
    expect(formatXlmAmount("0.0000000")).toBe("0,00 XLM");
  });
});

import { describe, expect, it } from "vitest";
import { xlmToStroops } from "./xlm-amount";

describe("xlmToStroops", () => {
  it("converts a whole amount", () => {
    expect(xlmToStroops("100")).toEqual({ ok: true, stroops: "1000000000" });
  });

  it("converts the 7-decimal maximum exactly", () => {
    expect(xlmToStroops("1.2345678")).toEqual({ ok: true, stroops: "12345678" });
  });

  it("converts the smallest representable amount, one stroop", () => {
    expect(xlmToStroops("0.0000001")).toEqual({ ok: true, stroops: "1" });
  });

  it("returns a decimal string, never a JSON number", () => {
    const result = xlmToStroops("1.5");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stroops).toBe("15000000");
    expect(typeof result.stroops).toBe("string");
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(xlmToStroops("  12.5  ")).toEqual({ ok: true, stroops: "125000000" });
  });

  it("rejects a negative amount", () => {
    expect(xlmToStroops("-1")).toEqual({ ok: false, error: "invalid_format" });
  });

  it("rejects a zero amount in either spelling", () => {
    expect(xlmToStroops("0")).toEqual({ ok: false, error: "not_positive" });
    expect(xlmToStroops("0.0000000")).toEqual({ ok: false, error: "not_positive" });
  });

  it("rejects an over-precise amount instead of rounding it", () => {
    expect(xlmToStroops("1.23456789")).toEqual({ ok: false, error: "too_many_decimals" });
    expect(xlmToStroops("0.00000001")).toEqual({ ok: false, error: "too_many_decimals" });
  });

  it("rejects a non-numeric amount", () => {
    expect(xlmToStroops("")).toEqual({ ok: false, error: "invalid_format" });
    expect(xlmToStroops("abc")).toEqual({ ok: false, error: "invalid_format" });
    expect(xlmToStroops("1e5")).toEqual({ ok: false, error: "invalid_format" });
    expect(xlmToStroops("1,5")).toEqual({ ok: false, error: "invalid_format" });
    expect(xlmToStroops("1.")).toEqual({ ok: false, error: "invalid_format" });
    expect(xlmToStroops(".5")).toEqual({ ok: false, error: "invalid_format" });
  });
});

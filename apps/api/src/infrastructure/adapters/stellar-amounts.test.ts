import { describe, expect, it } from "vitest";
import { xlmToStroops } from "./stellar-amounts.js";

describe("xlmToStroops", () => {
  it("converts a whole balance into stroops", () => {
    expect(xlmToStroops("10000.0000000")).toBe(100000000000n);
  });

  it("treats an amount with no decimal part as whole units", () => {
    expect(xlmToStroops("1")).toBe(10000000n);
  });

  it("converts the smallest representable amount", () => {
    expect(xlmToStroops("0.0000001")).toBe(1n);
  });

  it("converts zero", () => {
    expect(xlmToStroops("0.0000000")).toBe(0n);
  });

  it("keeps full precision past the range of a JavaScript number", () => {
    // The int64 maximum, expressed in stroops.
    expect(xlmToStroops("922337203685.4775807")).toBe(9223372036854775807n);

    // The same digits through `Number` do not survive: the nearest double is
    // one stroop higher, which is exactly the error this helper exists to avoid.
    expect(BigInt(Number("9223372036854775807"))).not.toBe(9223372036854775807n);
  });

  it("refuses more decimals than Stellar represents", () => {
    expect(() => xlmToStroops("1.00000001")).toThrow(/at most 7 decimals/);
  });

  it("refuses a value that is not a decimal amount", () => {
    expect(() => xlmToStroops("not-an-amount")).toThrow(/Malformed Stellar amount/);
    expect(() => xlmToStroops("")).toThrow(/Malformed Stellar amount/);
    expect(() => xlmToStroops("1e7")).toThrow(/Malformed Stellar amount/);
  });
});

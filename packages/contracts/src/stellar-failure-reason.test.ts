import { describe, expect, expectTypeOf, it } from "vitest";
import {
  parseStellarFailureReason,
  stellarFailureReasonSchema
} from "./index.js";

describe("stellarFailureReasonSchema", () => {
  it("accepts exactly the demo's failure vocabulary", () => {
    expect(stellarFailureReasonSchema.options).toEqual([
      "insufficient_balance",
      "bad_sequence",
      "insufficient_fee",
      "expired",
      "too_early",
      "unsuccessful"
    ]);
  });

  it.each([
    "insufficient_balance",
    "bad_sequence",
    "insufficient_fee",
    "expired",
    "too_early",
    "unsuccessful"
  ] as const)("parses %s", (reason) => {
    const parsed = parseStellarFailureReason(reason);

    expect(parsed).toBe(reason);
    expectTypeOf(parsed).toEqualTypeOf<
      "insufficient_balance" | "bad_sequence" | "insufficient_fee" | "expired" | "too_early" | "unsuccessful"
    >();
  });

  it.each([
    // Horizon's own enum, which this vocabulary exists to keep off the wire: a
    // provider's codes are not Vaqcrow's contract, and an SDK upgrade could
    // change them without anyone noticing.
    ["a raw Horizon result code", "tx_bad_seq"],
    ["a raw Horizon result code", "tx_failed"],
    ["a raw Horizon result code", "tx_too_late"],
    ["a Horizon async status", "PENDING"],
    ["a Horizon async status", "TRY_AGAIN_LATER"],
    ["an HTTP-ish value", "504"],
    ["an unrelated word", "pending"],
    ["a near-miss casing", "Expired"],
    ["an empty string", ""],
    ["a numeric value", 1],
    ["a null value", null]
  ])("rejects %s", (_description, value) => {
    expect(stellarFailureReasonSchema.safeParse(value).success).toBe(false);
  });
});

import { describe, expect, expectTypeOf, it } from "vitest";
import {
  parseWalletFailureEvent,
  walletFailureEventSchema,
  walletFailureOperationSchema,
  walletFailureOutcomeSchema
} from "./index.js";

describe("walletFailureOperationSchema", () => {
  it("accepts exactly the three wallet operations", () => {
    expect(walletFailureOperationSchema.options).toEqual([
      "connect",
      "sign_transaction",
      "sign_message"
    ]);
  });

  it.each(["connect", "sign_transaction", "sign_message"] as const)("parses %s", (operation) => {
    const parsed = walletFailureOperationSchema.parse(operation);

    expect(parsed).toBe(operation);
    expectTypeOf(parsed).toEqualTypeOf<"connect" | "sign_transaction" | "sign_message">();
  });

  it.each([
    // The web port names its operation `signTransaction`; the wire contract is
    // snake_case, so the camelCase call name is deliberately not a value.
    ["the camelCase port method name", "signTransaction"],
    ["an unknown operation", "disconnect"],
    ["a near-miss casing", "Connect"],
    ["an empty string", ""],
    ["a numeric value", 1],
    ["a null value", null]
  ])("rejects %s", (_description, value) => {
    expect(walletFailureOperationSchema.safeParse(value).success).toBe(false);
  });
});

describe("walletFailureOutcomeSchema", () => {
  it("accepts exactly the four outcomes the web port classifies", () => {
    expect(walletFailureOutcomeSchema.options).toEqual([
      "rejected",
      "unavailable",
      "network_mismatch",
      "unknown"
    ]);
  });

  it.each(["rejected", "unavailable", "network_mismatch", "unknown"] as const)(
    "parses %s",
    (outcome) => {
      const parsed = walletFailureOutcomeSchema.parse(outcome);

      expect(parsed).toBe(outcome);
      expectTypeOf(parsed).toEqualTypeOf<
        "rejected" | "unavailable" | "network_mismatch" | "unknown"
      >();
    }
  );

  it.each([
    ["an outcome with no name here", "failed"],
    ["a raw vendor code", "E_USER_REJECTED"],
    ["a near-miss casing", "Rejected"],
    ["an empty string", ""],
    ["a numeric value", 1],
    ["a null value", null]
  ])("rejects %s", (_description, value) => {
    expect(walletFailureOutcomeSchema.safeParse(value).success).toBe(false);
  });
});

describe("walletFailureEventSchema", () => {
  it("accepts a valid event and parses to exactly the two closed fields", () => {
    const parsed = parseWalletFailureEvent({ operation: "connect", outcome: "rejected" });

    expect(parsed).toEqual({ operation: "connect", outcome: "rejected" });
    expectTypeOf(parsed).toEqualTypeOf<{
      operation: "connect" | "sign_transaction" | "sign_message";
      outcome: "rejected" | "unavailable" | "network_mismatch" | "unknown";
    }>();
  });

  it.each([
    ["connect", "unavailable"],
    ["sign_transaction", "network_mismatch"],
    ["sign_message", "unknown"]
  ] as const)("accepts %s / %s", (operation, outcome) => {
    expect(walletFailureEventSchema.safeParse({ operation, outcome }).success).toBe(true);
  });

  it.each([
    ["an unknown operation", { operation: "signTransaction", outcome: "rejected" }],
    ["an unknown outcome", { operation: "connect", outcome: "failed" }],
    ["a missing operation", { outcome: "rejected" }],
    ["a missing outcome", { operation: "connect" }],
    ["an empty object", {}],
    // A closed, text-free vocabulary: anything else must be refused, not
    // stripped, so the caller learns the body drifted.
    ["a drifted extra key", { operation: "connect", outcome: "rejected", publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" }],
    ["a non-object body", "connect"],
    ["a null body", null]
  ])("rejects %s", (_description, value) => {
    expect(walletFailureEventSchema.safeParse(value).success).toBe(false);
    expect(() => parseWalletFailureEvent(value)).toThrow();
  });
});

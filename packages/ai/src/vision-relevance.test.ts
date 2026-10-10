import { describe, expect, it } from "vitest";
import { visionRelevanceSchema } from "./vision-relevance.js";

/**
 * The relevance verdict contract (Feature #402, U3).
 *
 * `strictObject` is the guardrail that matters: a model answer carrying an
 * extra field — an instruction channel, a tool-call shape — is rejected rather
 * than partially trusted. The empty reason is rejected too: "irrelevant" with
 * no explanation is not a finding a PyME can act on.
 */

describe("visionRelevanceSchema", () => {
  it("accepts a well-formed relevance verdict", () => {
    expect(
      visionRelevanceSchema.parse({ relevant: true, reason: "Es una Constancia de CUIT." })
    ).toEqual({ relevant: true, reason: "Es una Constancia de CUIT." });
  });

  it("trims the reason", () => {
    expect(visionRelevanceSchema.parse({ relevant: false, reason: "  no corresponde  " })).toEqual({
      relevant: false,
      reason: "no corresponde"
    });
  });

  it.each([
    ["a non-boolean relevant", { relevant: "yes", reason: "x" }],
    ["a missing relevant", { reason: "x" }],
    ["a missing reason", { relevant: true }],
    ["an empty reason", { relevant: true, reason: "" }],
    ["a blank reason", { relevant: true, reason: "   " }],
    ["an over-long reason", { relevant: true, reason: "a".repeat(301) }],
    ["an unknown field", { relevant: true, reason: "x", extra: 1 }]
  ])("rejects %s", (_label, value) => {
    expect(visionRelevanceSchema.safeParse(value).success).toBe(false);
  });
});

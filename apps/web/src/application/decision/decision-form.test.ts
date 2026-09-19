import { describe, expect, it } from "vitest";
import { decisionFingerprint, validateDecisionForm, type DecisionFormValues } from "./decision-form";

const base: DecisionFormValues = {
  outcome: "approved",
  actor: "operator:demo",
  reason: "Evidence reviewed by a person.",
  approvedLimitArs: "5000000"
};

describe("validateDecisionForm", () => {
  it("accepts an approved decision with a positive integer limit", () => {
    expect(validateDecisionForm(base)).toEqual({
      ok: true,
      input: {
        outcome: "approved",
        actor: "operator:demo",
        reason: "Evidence reviewed by a person.",
        approvedLimitArs: 5_000_000
      }
    });
  });

  it("trims actor and reason", () => {
    const result = validateDecisionForm({ ...base, actor: "  op  ", reason: "  why  " });
    expect(result).toMatchObject({ ok: true, input: { actor: "op", reason: "why" } });
  });

  it("requires an explicit outcome: nothing is pre-selected on the human's behalf", () => {
    const result = validateDecisionForm({ ...base, outcome: "" });
    expect(result).toMatchObject({ ok: false, errors: { outcome: expect.any(String) } });
  });

  it("requires a non-empty reason and actor", () => {
    const result = validateDecisionForm({ ...base, reason: "   ", actor: "" });
    expect(result).toMatchObject({ ok: false, errors: { reason: expect.any(String), actor: expect.any(String) } });
  });

  it("rejects reasons and actors above the contract limits", () => {
    const result = validateDecisionForm({ ...base, reason: "x".repeat(1001), actor: "a".repeat(121) });
    expect(result).toMatchObject({ ok: false, errors: { reason: expect.any(String), actor: expect.any(String) } });
  });

  it.each(["", "0", "-5", "1.5", "1e6", "abc", "9007199254740992", " "])(
    "rejects approved limit %j",
    (approvedLimitArs) => {
      const result = validateDecisionForm({ ...base, approvedLimitArs });
      expect(result).toMatchObject({ ok: false, errors: { approvedLimitArs: expect.any(String) } });
    }
  );

  it.each(["changes_requested", "rejected"] as const)(
    "sends exactly null as the limit for %s even when a limit was typed earlier",
    (outcome) => {
      const result = validateDecisionForm({ ...base, outcome, approvedLimitArs: "5000000" });
      expect(result).toMatchObject({ ok: true, input: { outcome, approvedLimitArs: null } });
    }
  );
});

describe("decisionFingerprint", () => {
  it("is identical for identical payloads and differs when any field changes", () => {
    const input = { outcome: "approved", actor: "a", reason: "r", approvedLimitArs: 10 } as const;
    expect(decisionFingerprint(input)).toBe(decisionFingerprint({ ...input }));
    expect(decisionFingerprint(input)).not.toBe(decisionFingerprint({ ...input, reason: "other" }));
    expect(decisionFingerprint(input)).not.toBe(decisionFingerprint({ ...input, approvedLimitArs: 11 }));
    expect(decisionFingerprint(input)).not.toBe(decisionFingerprint({ ...input, outcome: "rejected", approvedLimitArs: null }));
  });
});

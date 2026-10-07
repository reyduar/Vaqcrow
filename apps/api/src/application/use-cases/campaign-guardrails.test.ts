import { describe, expect, it } from "vitest";
import { validateCampaignGuardrails } from "./campaign-guardrails.js";

const rate = { usdToArs: 1_000_000n, stroopsPerUsd: 100n };

describe("validateCampaignGuardrails", () => {
  it("accepts a goal at the USD 50,000 ceiling and caps an investor at the lower rule", () => {
    expect(validateCampaignGuardrails({ goalStroops: 5_000_000n, investorContributionStroops: 500_000n, rate })).toEqual({ ok: true });
  });

  it("rejects a goal above USD 50,000 without floating point arithmetic", () => {
    expect(validateCampaignGuardrails({ goalStroops: 5_000_001n, rate })).toEqual({ ok: false, code: "goal_limit_exceeded" });
  });

  it("rejects an investor contribution above min(10%, USD 5,000)", () => {
    expect(validateCampaignGuardrails({ goalStroops: 1_000_000n, investorContributionStroops: 100_001n, rate })).toEqual({
      ok: false,
      code: "investor_limit_exceeded"
    });
  });
});

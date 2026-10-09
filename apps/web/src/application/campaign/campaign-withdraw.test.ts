import { describe, expect, it } from "vitest";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import type { CampaignDetail } from "@/application/ports/campaign-detail-port";
import { canWithdraw, type WithdrawGateInput } from "./campaign-withdraw";

const VAULT = "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";

function input(overrides: Partial<WithdrawGateInput> = {}): WithdrawGateInput {
  return {
    status: "funding" as CampaignDetail["status"],
    viewerRole: "INVERSOR" as PrincipalRole | null,
    vaultAddress: VAULT,
    investorContributionStroops: 25_000_000n,
    ...overrides
  };
}

describe("canWithdraw (WU5 gate)", () => {
  it("allows a funding campaign where the investor has a positive contribution", () => {
    expect(canWithdraw(input())).toBe(true);
  });

  it.each(["settled", "refunding"] as const)("hides the control on a %s campaign", (status) => {
    expect(canWithdraw(input({ status }))).toBe(false);
  });

  it.each(["PYME", "ADMIN", null] as const)("hides the control for a %s viewer", (viewerRole) => {
    expect(canWithdraw(input({ viewerRole }))).toBe(false);
  });

  it("hides the control when the contribution is zero", () => {
    expect(canWithdraw(input({ investorContributionStroops: 0n }))).toBe(false);
  });

  it("treats an unknown contribution as no reason to withdraw, never as zero", () => {
    expect(canWithdraw(input({ investorContributionStroops: null }))).toBe(false);
    expect(canWithdraw(input({ investorContributionStroops: undefined }))).toBe(false);
  });

  it("hides the control when the campaign has no vault id", () => {
    expect(canWithdraw(input({ vaultAddress: null }))).toBe(false);
    expect(canWithdraw(input({ vaultAddress: "   " }))).toBe(false);
  });
});

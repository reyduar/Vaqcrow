import type { RateSnapshot } from "../ports/rate-table-repository-port.js";

export const RATE_SCALE = 1_000_000n;
const MAX_GOAL_USD = 50_000n;
const MAX_INVESTOR_USD = 5_000n;

export type CampaignGuardrailError = "invalid_rate" | "goal_limit_exceeded" | "investor_limit_exceeded";

export function validateCampaignGuardrails(input: {
  readonly goalStroops: bigint;
  readonly investorContributionStroops?: bigint;
  readonly rate: Pick<RateSnapshot, "usdToArs" | "stroopsPerUsd">;
}): { readonly ok: true } | { readonly ok: false; readonly code: CampaignGuardrailError } {
  if (input.rate.usdToArs <= 0n || input.rate.stroopsPerUsd <= 0n || input.goalStroops <= 0n) {
    return { ok: false, code: "invalid_rate" };
  }

  const maxGoal = MAX_GOAL_USD * input.rate.stroopsPerUsd;
  if (input.goalStroops > maxGoal) return { ok: false, code: "goal_limit_exceeded" };

  if (input.investorContributionStroops !== undefined) {
    const maxInvestor = (input.goalStroops * 10n) / 100n;
    const absoluteMax = MAX_INVESTOR_USD * input.rate.stroopsPerUsd;
    if (input.investorContributionStroops > (maxInvestor < absoluteMax ? maxInvestor : absoluteMax)) {
      return { ok: false, code: "investor_limit_exceeded" };
    }
  }
  return { ok: true };
}

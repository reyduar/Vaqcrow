/**
 * Deterministic revenue-share engine.
 *
 * Money is always an integer count of minor units (`bigint`) and the rate is an integer
 * count of basis points, so no floating point value ever touches an amount. The engine is
 * pure and framework-free: it does not call an LLM, Supabase, Horizon or any other service.
 * Every failure is returned as a sanitized `{ ok: false, error }` value; nothing is thrown.
 */

/** Canonical rule version for the demo revenue share, fixed by docs/design/demo-ui.md. */
export const REVENUE_SHARE_RULE_VERSION = "RS-2026-01";

export const revenueShareRoundingPolicies = ["floor", "half_up"] as const;

export type RevenueShareRoundingPolicy = (typeof revenueShareRoundingPolicies)[number];

export const revenueSharePeriodStatuses = ["reported", "missing", "anomalous"] as const;

export type RevenueSharePeriodStatus = (typeof revenueSharePeriodStatuses)[number];

export interface RevenueShareRule {
  readonly version: string;
  /** Integer basis points: 1 bp = 0.01 %, so 4.50 % is 450. */
  readonly rateBps: number;
  readonly rounding: RevenueShareRoundingPolicy;
}

export interface RevenueSharePeriod {
  readonly period: string;
  readonly salesMinorUnits: bigint | null;
  readonly status: RevenueSharePeriodStatus;
}

export interface RevenueShareContributor {
  readonly contributorId: string;
  readonly contributionMinorUnits: bigint;
}

export interface RevenueShareEligiblePeriod {
  readonly period: string;
  readonly salesMinorUnits: bigint;
}

export type RevenueShareExclusionReason = "missing_data" | "requires_review";

export interface RevenueShareExcludedPeriod {
  readonly period: string;
  readonly status: RevenueSharePeriodStatus;
  readonly reason: RevenueShareExclusionReason;
}

export interface RevenueShareObligation {
  readonly ruleVersion: string;
  readonly rateBps: number;
  readonly rounding: RevenueShareRoundingPolicy;
  readonly eligiblePeriods: readonly RevenueShareEligiblePeriod[];
  readonly excludedPeriods: readonly RevenueShareExcludedPeriod[];
  readonly eligibleSalesMinorUnits: bigint;
  readonly obligationMinorUnits: bigint;
}

export interface RevenueShareAllocation {
  readonly contributorId: string;
  readonly contributionMinorUnits: bigint;
  readonly allocationMinorUnits: bigint;
}

export interface RevenueShareDistribution {
  readonly obligation: RevenueShareObligation;
  readonly allocations: readonly RevenueShareAllocation[];
  readonly totalAllocatedMinorUnits: bigint;
}

export type RevenueShareErrorCode =
  | "invalid_rule"
  | "invalid_period"
  | "invalid_contributor"
  | "no_contributors";

export interface RevenueShareError {
  readonly code: RevenueShareErrorCode;
}

export type RevenueShareResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RevenueShareError };

/** Demo rule: 4.50 % (450 bps) with floor rounding, matching docs/design/demo-ui.md. */
export const demoRevenueShareRule: RevenueShareRule = Object.freeze({
  version: REVENUE_SHARE_RULE_VERSION,
  rateBps: 450,
  rounding: "floor"
});

const BASIS_POINT_DENOMINATOR = 10_000n;
const HALF_UP_OFFSET = 5_000n;

function validateRule(rule: RevenueShareRule): RevenueShareError | null {
  if (typeof rule.version !== "string" || rule.version.trim().length === 0) {
    return { code: "invalid_rule" };
  }

  if (!Number.isInteger(rule.rateBps) || rule.rateBps < 1 || rule.rateBps > 10_000) {
    return { code: "invalid_rule" };
  }

  if (!revenueShareRoundingPolicies.includes(rule.rounding)) {
    return { code: "invalid_rule" };
  }

  return null;
}

function validatePeriods(periods: readonly RevenueSharePeriod[]): RevenueShareError | null {
  for (const entry of periods) {
    if (typeof entry.period !== "string" || entry.period.trim().length === 0) {
      return { code: "invalid_period" };
    }

    if (!revenueSharePeriodStatuses.includes(entry.status)) {
      return { code: "invalid_period" };
    }

    // A reported period must carry a real bigint amount: a null amount is malformed input,
    // not an exclusion, so it is rejected instead of silently billed as zero.
    if (
      entry.status === "reported" &&
      (entry.salesMinorUnits === null || typeof entry.salesMinorUnits !== "bigint")
    ) {
      return { code: "invalid_period" };
    }
  }

  return null;
}

function validateContributors(
  contributors: readonly RevenueShareContributor[]
): RevenueShareError | null {
  const seenIds = new Set<string>();

  for (const entry of contributors) {
    if (typeof entry.contributorId !== "string" || entry.contributorId.trim().length === 0) {
      return { code: "invalid_contributor" };
    }

    if (typeof entry.contributionMinorUnits !== "bigint" || entry.contributionMinorUnits <= 0n) {
      return { code: "invalid_contributor" };
    }

    // Identity is compared on the trimmed id, so "abc" and " abc" cannot both be contributors.
    const key = entry.contributorId.trim();
    if (seenIds.has(key)) {
      return { code: "invalid_contributor" };
    }
    seenIds.add(key);
  }

  return null;
}

interface CollectedPeriods {
  readonly eligible: readonly RevenueShareEligiblePeriod[];
  readonly excluded: readonly RevenueShareExcludedPeriod[];
  readonly eligibleSalesMinorUnits: bigint;
}

/**
 * Eligibility is hard and deterministic (D3): only a `reported` period with a real amount is
 * billable. `missing` and `anomalous` periods are excluded with an explicit reason and are
 * returned in the obligation — never silently dropped — so the audit trail stays truthful.
 * Input order is preserved in both lists.
 */
function collectPeriods(periods: readonly RevenueSharePeriod[]): CollectedPeriods {
  const eligible: RevenueShareEligiblePeriod[] = [];
  const excluded: RevenueShareExcludedPeriod[] = [];
  let eligibleSalesMinorUnits = 0n;

  for (const entry of periods) {
    if (entry.status === "reported" && entry.salesMinorUnits !== null) {
      eligible.push({ period: entry.period, salesMinorUnits: entry.salesMinorUnits });
      eligibleSalesMinorUnits += entry.salesMinorUnits;
      continue;
    }

    if (entry.status === "missing") {
      excluded.push({ period: entry.period, status: "missing", reason: "missing_data" });
      continue;
    }

    excluded.push({ period: entry.period, status: "anomalous", reason: "requires_review" });
  }

  return { eligible, excluded, eligibleSalesMinorUnits };
}

/**
 * Rounding is explicit (D4). BigInt division is integer division that truncates toward zero;
 * every value here is non-negative, so truncation is floor. The policy is applied exactly once
 * to the aggregate obligation, never per period, so the result cannot drift across periods.
 */
function applyRounding(
  eligibleSalesMinorUnits: bigint,
  rateBps: number,
  rounding: RevenueShareRoundingPolicy
): bigint {
  const numerator = eligibleSalesMinorUnits * BigInt(rateBps);

  if (rounding === "half_up") {
    return (numerator + HALF_UP_OFFSET) / BASIS_POINT_DENOMINATOR;
  }

  return numerator / BASIS_POINT_DENOMINATOR;
}

function buildObligation(
  rule: RevenueShareRule,
  periods: readonly RevenueSharePeriod[]
): RevenueShareObligation {
  const { eligible, excluded, eligibleSalesMinorUnits } = collectPeriods(periods);

  return {
    ruleVersion: rule.version,
    rateBps: rule.rateBps,
    rounding: rule.rounding,
    eligiblePeriods: eligible,
    excludedPeriods: excluded,
    eligibleSalesMinorUnits,
    obligationMinorUnits: applyRounding(eligibleSalesMinorUnits, rule.rateBps, rule.rounding)
  };
}

/**
 * Allocations are balanced and deterministic (D5). Each contributor receives the truncated
 * proportional share; the residual units are handed out by the largest-remainder method,
 * ties broken by ascending contributor index. The allocations therefore always sum exactly
 * to the obligation.
 */
function buildAllocations(
  obligationMinorUnits: bigint,
  contributors: readonly RevenueShareContributor[]
): readonly RevenueShareAllocation[] {
  if (obligationMinorUnits === 0n) {
    return contributors.map((entry) => ({
      contributorId: entry.contributorId,
      contributionMinorUnits: entry.contributionMinorUnits,
      allocationMinorUnits: 0n
    }));
  }

  const totalContribution = contributors.reduce(
    (sum, entry) => sum + entry.contributionMinorUnits,
    0n
  );

  const bases: bigint[] = [];
  const remainders: bigint[] = [];

  for (const entry of contributors) {
    const numerator = obligationMinorUnits * entry.contributionMinorUnits;
    bases.push(numerator / totalContribution);
    remainders.push(numerator % totalContribution);
  }

  const distributed = bases.reduce((sum, base) => sum + base, 0n);
  const residual = obligationMinorUnits - distributed;

  const ranked = contributors
    .map((_, index) => index)
    .sort((left, right) => {
      const leftRemainder = remainders[left] ?? 0n;
      const rightRemainder = remainders[right] ?? 0n;

      if (leftRemainder !== rightRemainder) {
        return leftRemainder > rightRemainder ? -1 : 1;
      }

      return left - right;
    });

  const rewardedIndexes = new Set(ranked.slice(0, Number(residual)));

  return contributors.map((entry, index) => ({
    contributorId: entry.contributorId,
    contributionMinorUnits: entry.contributionMinorUnits,
    allocationMinorUnits: (bases[index] ?? 0n) + (rewardedIndexes.has(index) ? 1n : 0n)
  }));
}

/**
 * Applies the single semantic allocation rule shared by the standalone allocator and the
 * composed distribution: a positive obligation needs at least one contributor.
 */
function resolveAllocations(
  obligationMinorUnits: bigint,
  contributors: readonly RevenueShareContributor[]
): RevenueShareResult<readonly RevenueShareAllocation[]> {
  if (obligationMinorUnits > 0n && contributors.length === 0) {
    return { ok: false, error: { code: "no_contributors" } };
  }

  return { ok: true, value: buildAllocations(obligationMinorUnits, contributors) };
}

export function calculateRevenueShareObligation(input: {
  readonly rule: RevenueShareRule;
  readonly periods: readonly RevenueSharePeriod[];
}): RevenueShareResult<RevenueShareObligation> {
  const ruleError = validateRule(input.rule);
  if (ruleError !== null) {
    return { ok: false, error: ruleError };
  }

  const periodError = validatePeriods(input.periods);
  if (periodError !== null) {
    return { ok: false, error: periodError };
  }

  return { ok: true, value: buildObligation(input.rule, input.periods) };
}

export function allocateRevenueShare(input: {
  readonly obligationMinorUnits: bigint;
  readonly contributors: readonly RevenueShareContributor[];
}): RevenueShareResult<readonly RevenueShareAllocation[]> {
  const contributorError = validateContributors(input.contributors);
  if (contributorError !== null) {
    return { ok: false, error: contributorError };
  }

  return resolveAllocations(input.obligationMinorUnits, input.contributors);
}

export function calculateRevenueShareDistribution(input: {
  readonly rule: RevenueShareRule;
  readonly periods: readonly RevenueSharePeriod[];
  readonly contributors: readonly RevenueShareContributor[];
}): RevenueShareResult<RevenueShareDistribution> {
  // Every input is validated before any arithmetic runs, so the first invalid input decides
  // the sanitized error and no partial computation is ever observed.
  const ruleError = validateRule(input.rule);
  if (ruleError !== null) {
    return { ok: false, error: ruleError };
  }

  const periodError = validatePeriods(input.periods);
  if (periodError !== null) {
    return { ok: false, error: periodError };
  }

  const contributorError = validateContributors(input.contributors);
  if (contributorError !== null) {
    return { ok: false, error: contributorError };
  }

  const obligation = buildObligation(input.rule, input.periods);

  const allocationResult = resolveAllocations(obligation.obligationMinorUnits, input.contributors);
  if (!allocationResult.ok) {
    return allocationResult;
  }

  const allocations = allocationResult.value;
  const totalAllocatedMinorUnits = allocations.reduce(
    (sum, entry) => sum + entry.allocationMinorUnits,
    0n
  );

  if (totalAllocatedMinorUnits !== obligation.obligationMinorUnits) {
    // Unreachable by construction: the largest-remainder split is balanced. Kept as a
    // defensive invariant so a future refactor cannot silently unbalance the total.
    return { ok: false, error: { code: "invalid_contributor" } };
  }

  return { ok: true, value: { obligation, allocations, totalAllocatedMinorUnits } };
}

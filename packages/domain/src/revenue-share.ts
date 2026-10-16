/**
 * Deterministic revenue-share engine.
 *
 * Money is always an integer count of minor units (`bigint`) and the rate is an integer
 * count of basis points, so no floating point value ever touches an amount. The engine is
 * pure and framework-free: it does not call an LLM, Supabase, Horizon or any other service.
 * Every failure is returned as a sanitized `{ ok: false, error }` value; nothing is thrown.
 */

/** Canonical rule version for the demo revenue share, fixed by docs/design/demo-ui.md. */
export const REVENUE_SHARE_RULE_VERSION = "RS-2026-02";

export const revenueShareRoundingPolicies = Object.freeze(["floor", "half_up"] as const);

export type RevenueShareRoundingPolicy = (typeof revenueShareRoundingPolicies)[number];

export const revenueSharePeriodStatuses = Object.freeze(["reported", "missing", "anomalous"] as const);

export type RevenueSharePeriodStatus = (typeof revenueSharePeriodStatuses)[number];

export interface RevenueShareRule {
  readonly version: string;
  /** Integer basis points: 1 bp = 0.01 %, so 4.50 % is 450. */
  readonly rateBps: number;
  readonly rounding: RevenueShareRoundingPolicy;
  /**
   * Cap on what one contributor can ever receive, as a fraction of their contribution:
   * `cap = floor(contribution * capNumerator / capDenominator)`. `3/2` is exactly 1.5×. The
   * agreement ends for a contributor once their accumulated distributions reach their cap, so a
   * numerator below the denominator (a cap smaller than the contribution) is not a valid rule.
   * Both are integers and no float ever touches an amount.
   */
  readonly capNumerator: number;
  readonly capDenominator: number;
}

export interface RevenueSharePeriod {
  readonly period: string;
  readonly salesMinorUnits: bigint | null;
  readonly status: RevenueSharePeriodStatus;
}

export interface RevenueShareContributor {
  readonly contributorId: string;
  readonly contributionMinorUnits: bigint;
  /**
   * What this contributor has already received across confirmed distributions, used to derive
   * their remaining capacity. Required on purpose: an optional field defaulting to `0n` would
   * silently restore the pay-forever behaviour at any call site that forgets it. A caller passes
   * `0n` when nothing has been distributed yet. Values at or above the cap leave no capacity.
   */
  readonly distributedMinorUnits: bigint;
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

/**
 * The outcome of allocating one run's obligation across contributors: the per-contributor
 * allocations, their exact total, and whether the agreement is finished.
 *
 * `agreementComplete` is `true` exactly when every contributor had already reached their cap
 * before this run, so a caller can tell "nothing to pay this period" apart from "nothing left to
 * pay, ever" — the terminal state of the agreement (S3/S4).
 */
export interface RevenueShareAllocationOutcome {
  readonly allocations: readonly RevenueShareAllocation[];
  readonly totalAllocatedMinorUnits: bigint;
  readonly agreementComplete: boolean;
}

export interface RevenueShareDistribution {
  readonly obligation: RevenueShareObligation;
  readonly allocations: readonly RevenueShareAllocation[];
  readonly totalAllocatedMinorUnits: bigint;
  /**
   * `true` when every contributor had already reached their cap before this run, so the
   * agreement is finished and there is nothing left to distribute. It is computed from the
   * contributors' accumulated distributions, so it flags the call that would otherwise repeat an
   * all-zero allocation instead of leaving the caller to interpret one.
   */
  readonly agreementComplete: boolean;
}

export type RevenueShareErrorCode =
  | "invalid_rule"
  | "invalid_period"
  | "invalid_contributor"
  | "invalid_obligation"
  | "no_contributors";

export interface RevenueShareError {
  readonly code: RevenueShareErrorCode;
}

export type RevenueShareResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RevenueShareError };

/** Demo rule: 4.50 % (450 bps) with floor rounding and a 1.5× cap, matching docs/design/demo-ui.md. */
export const demoRevenueShareRule: RevenueShareRule = Object.freeze({
  version: REVENUE_SHARE_RULE_VERSION,
  rateBps: 450,
  rounding: "floor",
  capNumerator: 3,
  capDenominator: 2
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

  // The cap fraction must be a real, whole multiple of the contribution: a positive integer
  // denominator and a numerator that is at least the denominator. A numerator below the
  // denominator would mean a cap smaller than the contribution, which is not a rule this
  // product has; a fractional or zero denominator would make the cap meaningless.
  if (
    !Number.isInteger(rule.capNumerator) ||
    !Number.isInteger(rule.capDenominator) ||
    rule.capDenominator < 1 ||
    rule.capNumerator < rule.capDenominator
  ) {
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

    // A reported period must carry a real, non-negative bigint amount: a null or negative
    // amount is malformed input, not an exclusion, so it is rejected instead of silently
    // billed as zero or summed into a negative aggregate.
    if (
      entry.status === "reported" &&
      (typeof entry.salesMinorUnits !== "bigint" || entry.salesMinorUnits < 0n)
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

    // The accumulator is a count of what was already paid, so it cannot be negative and it must
    // be a real bigint. Values at or above the cap are valid: they simply leave no capacity.
    if (typeof entry.distributedMinorUnits !== "bigint" || entry.distributedMinorUnits < 0n) {
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
 * The cap of one contributor: an integer multiple of their contribution, floored. `3/2` is
 * exactly 1.5×; BigInt division truncates toward zero and every value here is non-negative, so it
 * is floor, and no float ever touches an amount.
 */
function contributorCapMinorUnits(
  contributionMinorUnits: bigint,
  capNumerator: number,
  capDenominator: number
): bigint {
  return (contributionMinorUnits * BigInt(capNumerator)) / BigInt(capDenominator);
}

/** `remaining_i = max(0n, cap_i - distributed_i)`: capacity is clamped and never negative. */
function remainingCapacityMinorUnits(
  capMinorUnits: bigint,
  distributedMinorUnits: bigint
): bigint {
  return capMinorUnits > distributedMinorUnits ? capMinorUnits - distributedMinorUnits : 0n;
}

/**
 * Allocates `distributableMinorUnits` among the contributors that still have capacity, in
 * proportion to their contribution with the largest-remainder method and an ascending-index
 * tie-break, truncating every payment at that contributor's remaining capacity and redistributing
 * whatever the truncation leaves over.
 *
 * Termination and determinism: each pass allocates the current pool by proportion and then
 * truncates. If nothing is truncated the pass assigned the whole pool and the loop ends; if
 * something is truncated, that contributor reached its cap exactly and carries no capacity into
 * the next pass. So every pass that does not finish the loop permanently exhausts at least one
 * contributor's capacity, and there can be at most as many such passes as contributors. While
 * the pool is positive and some contributor has capacity, a pass always assigns at least one
 * unit, so the pool strictly decreases and the loop cannot spin.
 */
function buildCappedAllocations(
  distributableMinorUnits: bigint,
  contributors: readonly RevenueShareContributor[],
  capacityMinorUnits: readonly bigint[]
): readonly bigint[] {
  const payments = contributors.map(() => 0n);
  const capacity = contributors.map((_, index) => capacityMinorUnits[index] ?? 0n);

  let pool = distributableMinorUnits;

  while (pool > 0n) {
    const activePositions: number[] = [];
    for (let index = 0; index < contributors.length; index += 1) {
      if ((capacity[index] ?? 0n) - (payments[index] ?? 0n) > 0n) {
        activePositions.push(index);
      }
    }

    if (activePositions.length === 0) break;

    // Every contribution is positive (validateContributors), so this total is positive.
    const totalActiveContribution = activePositions.reduce(
      (sum, index) => sum + (contributors[index]?.contributionMinorUnits ?? 0n),
      0n
    );

    const bases: bigint[] = [];
    const remainders: bigint[] = [];

    for (const index of activePositions) {
      const numerator = pool * (contributors[index]?.contributionMinorUnits ?? 0n);
      bases.push(numerator / totalActiveContribution);
      remainders.push(numerator % totalActiveContribution);
    }

    const distributed = bases.reduce((sum, base) => sum + base, 0n);
    const residual = pool - distributed;

    // The residual is always smaller than the number of active contributors, so `Number(residual)`
    // is an exact count and the top-`residual` remainders each take one unit.
    const ranked = bases
      .map((_, position) => position)
      .sort((left, right) => {
        const leftRemainder = remainders[left] ?? 0n;
        const rightRemainder = remainders[right] ?? 0n;

        if (leftRemainder !== rightRemainder) {
          return leftRemainder > rightRemainder ? -1 : 1;
        }

        return (activePositions[left] ?? 0) - (activePositions[right] ?? 0);
      });

    const rewarded = new Set(ranked.slice(0, Number(residual)));

    let assignedThisPass = 0n;

    for (let position = 0; position < activePositions.length; position += 1) {
      const index = activePositions[position] ?? 0;
      const capacityLeft = (capacity[index] ?? 0n) - (payments[index] ?? 0n);
      const tentative = (bases[position] ?? 0n) + (rewarded.has(position) ? 1n : 0n);
      // Truncate at the cap: the payment that crosses it is cut to exactly what was left.
      const payment = tentative > capacityLeft ? capacityLeft : tentative;

      payments[index] = (payments[index] ?? 0n) + payment;
      assignedThisPass += payment;
    }

    pool -= assignedThisPass;
  }

  return payments;
}

/**
 * The one allocation algorithm both entry points share, so neither can enforce a different rule.
 *
 * The obligation is distributed pro-rata by contribution, truncated at each contributor's
 * remaining capacity and redistributed while capacity is left. The pool is clamped to the total
 * remaining capacity, so the invariant is `totalAllocated == min(obligation, sum remaining_i)`,
 * and the terminal flag is derived from the capacities rather than supplied by the caller. The
 * obligation is checked first, so a negative obligation is reported as `invalid_obligation`
 * rather than the misleading `no_contributors`.
 */
function allocateCappedRevenueShare(input: {
  readonly rule: RevenueShareRule;
  readonly obligationMinorUnits: bigint;
  readonly contributors: readonly RevenueShareContributor[];
}): RevenueShareResult<RevenueShareAllocationOutcome> {
  if (typeof input.obligationMinorUnits !== "bigint" || input.obligationMinorUnits < 0n) {
    return { ok: false, error: { code: "invalid_obligation" } };
  }

  if (input.obligationMinorUnits > 0n && input.contributors.length === 0) {
    return { ok: false, error: { code: "no_contributors" } };
  }

  const capacities = input.contributors.map((entry) =>
    remainingCapacityMinorUnits(
      contributorCapMinorUnits(
        entry.contributionMinorUnits,
        input.rule.capNumerator,
        input.rule.capDenominator
      ),
      entry.distributedMinorUnits
    )
  );

  const totalCapacityMinorUnits = capacities.reduce((sum, capacity) => sum + capacity, 0n);

  // distributable = min(obligation, sum of remaining_i): the per-contributor cap can leave part of
  // the pool undistributable, which is exactly what the cap is for.
  const distributableMinorUnits =
    input.obligationMinorUnits < totalCapacityMinorUnits
      ? input.obligationMinorUnits
      : totalCapacityMinorUnits;

  const paid = buildCappedAllocations(distributableMinorUnits, input.contributors, capacities);

  const allocations: readonly RevenueShareAllocation[] = input.contributors.map((entry, index) => ({
    contributorId: entry.contributorId,
    contributionMinorUnits: entry.contributionMinorUnits,
    allocationMinorUnits: paid[index] ?? 0n
  }));

  const totalAllocatedMinorUnits = paid.reduce((sum, payment) => sum + payment, 0n);

  if (totalAllocatedMinorUnits !== distributableMinorUnits) {
    // Defensive, not a live branch: the capped allocator distributes the whole pool by
    // construction. The rewritten invariant is `totalAllocated == min(obligation, sum
    // remaining_i)` — always <= the obligation, and equal to it exactly when the caps do not
    // truncate.
    return { ok: false, error: { code: "invalid_contributor" } };
  }

  return {
    ok: true,
    value: {
      allocations,
      totalAllocatedMinorUnits,
      // The terminal state (S3.7): every contributor is at or past their cap, so there is nothing
      // left to distribute — this call would otherwise repeat an all-zero allocation forever.
      agreementComplete: totalCapacityMinorUnits === 0n
    }
  };
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

/**
 * Allocates an obligation the caller already computed — for example one converted to stroops — in
 * proportion to the contributions, enforcing the rule's per-contributor cap.
 *
 * The obligation stays an input (the caller owns how it was derived). The rule is required, never
 * optional with a silent default: a call that forgot the cap would restore the pay-forever
 * behaviour this cap exists to remove, so there is deliberately no signature that allocates
 * without it. `calculateRevenueShareDistribution` reaches the same allocator, so both entry points
 * enforce the identical rule.
 */
export function allocateRevenueShare(input: {
  readonly rule: RevenueShareRule;
  readonly obligationMinorUnits: bigint;
  readonly contributors: readonly RevenueShareContributor[];
}): RevenueShareResult<RevenueShareAllocationOutcome> {
  const ruleError = validateRule(input.rule);
  if (ruleError !== null) {
    return { ok: false, error: ruleError };
  }

  const contributorError = validateContributors(input.contributors);
  if (contributorError !== null) {
    return { ok: false, error: contributorError };
  }

  return allocateCappedRevenueShare(input);
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

  // The cap is applied through the same allocator the standalone entry point uses, so both entry
  // points enforce the identical rule and neither can drift. A positive obligation with nobody to
  // pay is the same input error the standalone allocator reports; a positive obligation that
  // nobody can still be paid is not an error — it is the terminal state, and `agreementComplete`
  // says so.
  const allocation = allocateCappedRevenueShare({
    rule: input.rule,
    obligationMinorUnits: obligation.obligationMinorUnits,
    contributors: input.contributors
  });

  if (!allocation.ok) {
    return allocation;
  }

  return {
    ok: true,
    value: {
      obligation,
      allocations: allocation.value.allocations,
      totalAllocatedMinorUnits: allocation.value.totalAllocatedMinorUnits,
      agreementComplete: allocation.value.agreementComplete
    }
  };
}

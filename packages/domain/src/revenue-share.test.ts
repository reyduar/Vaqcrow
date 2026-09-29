import { describe, expect, expectTypeOf, it } from "vitest";
import {
  REVENUE_SHARE_RULE_VERSION,
  allocateRevenueShare,
  calculateRevenueShareDistribution,
  calculateRevenueShareObligation,
  demoRevenueShareRule,
  revenueSharePeriodStatuses,
  revenueShareRoundingPolicies
} from "./revenue-share.js";
import type {
  RevenueShareContributor,
  RevenueShareError,
  RevenueShareErrorCode,
  RevenueShareObligation,
  RevenueSharePeriod,
  RevenueShareResult,
  RevenueShareRoundingPolicy,
  RevenueShareRule
} from "./revenue-share.js";

const DEMO_SALES_MINOR_UNITS = 3_745_800n;

/** Builds the demo rule with targeted overrides, so a failure names the field under test. */
function ruleWith(overrides: Partial<RevenueShareRule>): RevenueShareRule {
  return { ...demoRevenueShareRule, ...overrides };
}

function period(
  value: string,
  salesMinorUnits: bigint | null,
  status: RevenueSharePeriod["status"]
): RevenueSharePeriod {
  return { period: value, salesMinorUnits, status };
}

function contributor(contributorId: string, contributionMinorUnits: bigint): RevenueShareContributor {
  return { contributorId, contributionMinorUnits };
}

/** Asserts the exact sanitized failure, so no extra error field can leak. */
function expectError<T>(result: RevenueShareResult<T>, code: RevenueShareErrorCode): void {
  expect(result).toEqual({ ok: false, error: { code } });
}

/** Narrows a successful result or fails the test with the observed error code. */
function expectOk<T>(result: RevenueShareResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected ok result, received error "${result.error.code}"`);
  }
  return result.value;
}

describe("rule constants and demo rule", () => {
  it("exposes the canonical rule version, rounding policies and period statuses", () => {
    expect(REVENUE_SHARE_RULE_VERSION).toBe("RS-2026-01");
    expect(revenueShareRoundingPolicies).toEqual(["floor", "half_up"]);
    expect(revenueSharePeriodStatuses).toEqual(["reported", "missing", "anomalous"]);
  });

  it("exposes the frozen demo rule as 4.50% in basis points with floor rounding", () => {
    expect(demoRevenueShareRule).toEqual({
      version: "RS-2026-01",
      rateBps: 450,
      rounding: "floor"
    });
    expect(Object.isFrozen(demoRevenueShareRule)).toBe(true);
  });

  it("keeps the public types honest at compile time", () => {
    expectTypeOf<typeof REVENUE_SHARE_RULE_VERSION>().toEqualTypeOf<"RS-2026-01">();
    expectTypeOf(demoRevenueShareRule).toEqualTypeOf<RevenueShareRule>();
    expectTypeOf(demoRevenueShareRule.rounding).toEqualTypeOf<RevenueShareRoundingPolicy>();
    expectTypeOf<RevenueSharePeriod["salesMinorUnits"]>().toEqualTypeOf<bigint | null>();
    expectTypeOf<RevenueShareError["code"]>().toEqualTypeOf<RevenueShareErrorCode>();
  });
});

describe("calculateRevenueShareObligation — eligibility (D3)", () => {
  it("marks a reported period with an amount as eligible", () => {
    const result = calculateRevenueShareObligation({
      rule: demoRevenueShareRule,
      periods: [period("2026-08", DEMO_SALES_MINOR_UNITS, "reported")]
    });

    const obligation = expectOk(result);
    expect(obligation.eligiblePeriods).toEqual([
      { period: "2026-08", salesMinorUnits: DEMO_SALES_MINOR_UNITS }
    ]);
    expect(obligation.excludedPeriods).toEqual([]);
  });

  it("excludes a missing period as missing_data and an anomalous period as requires_review", () => {
    const result = calculateRevenueShareObligation({
      rule: demoRevenueShareRule,
      periods: [
        period("2026-07", null, "missing"),
        period("2026-06", null, "anomalous")
      ]
    });

    const obligation = expectOk(result);
    expect(obligation.eligiblePeriods).toEqual([]);
    expect(obligation.excludedPeriods).toEqual([
      { period: "2026-07", status: "missing", reason: "missing_data" },
      { period: "2026-06", status: "anomalous", reason: "requires_review" }
    ]);
  });

  it("preserves input order across both the eligible and excluded lists", () => {
    const result = calculateRevenueShareObligation({
      rule: demoRevenueShareRule,
      periods: [
        period("2026-01", 100n, "reported"),
        period("2026-02", null, "missing"),
        period("2026-03", 200n, "reported"),
        period("2026-04", null, "anomalous")
      ]
    });

    const obligation = expectOk(result);
    expect(obligation.eligiblePeriods.map((entry) => entry.period)).toEqual(["2026-01", "2026-03"]);
    expect(obligation.excludedPeriods.map((entry) => entry.period)).toEqual(["2026-02", "2026-04"]);
  });

  it("exposes the rule version, rate and rounding on the obligation for the audit trail", () => {
    const obligation = expectOk(
      calculateRevenueShareObligation({
        rule: demoRevenueShareRule,
        periods: [period("2026-08", DEMO_SALES_MINOR_UNITS, "reported")]
      })
    );

    expect(obligation.ruleVersion).toBe("RS-2026-01");
    expect(obligation.rateBps).toBe(450);
    expect(obligation.rounding).toBe("floor");
  });
});

describe("calculateRevenueShareObligation — amount and rounding (D4)", () => {
  it("computes the design example: 3,745,800 × 4.50% = 168,561 minor units", () => {
    const obligation = expectOk(
      calculateRevenueShareObligation({
        rule: demoRevenueShareRule,
        periods: [period("2026-08", DEMO_SALES_MINOR_UNITS, "reported")]
      })
    );

    expect(obligation.eligibleSalesMinorUnits).toBe(3_745_800n);
    expect(obligation.obligationMinorUnits).toBe(168_561n);
  });

  it("sums eligible periods and applies the rate once to the aggregate", () => {
    const obligation = expectOk(
      calculateRevenueShareObligation({
        rule: demoRevenueShareRule,
        periods: [period("2026-01", 100n, "reported"), period("2026-02", 100n, "reported")]
      })
    );

    // 200 × 450 / 10000 = 9. Flooring each period first would give 4 + 4 = 8,
    // so 9 proves the rate is applied once to the aggregate.
    expect(obligation.eligibleSalesMinorUnits).toBe(200n);
    expect(obligation.obligationMinorUnits).toBe(9n);
  });

  it("distinguishes floor from half_up on a non-zero remainder", () => {
    // 100 × 450 = 45,000; /10000 leaves a remainder of 5,000.
    const periods = [period("2026-01", 100n, "reported")];

    const floored = expectOk(
      calculateRevenueShareObligation({ rule: ruleWith({ rounding: "floor" }), periods })
    );
    const halfUp = expectOk(
      calculateRevenueShareObligation({ rule: ruleWith({ rounding: "half_up" }), periods })
    );

    expect(floored.obligationMinorUnits).toBe(4n);
    expect(halfUp.obligationMinorUnits).toBe(5n);
  });
});

describe("allocateRevenueShare — balanced allocations (D5)", () => {
  it("splits 100 across three equal contributions as 34 / 33 / 33 and stays balanced", () => {
    const allocations = expectOk(
      allocateRevenueShare({
        obligationMinorUnits: 100n,
        contributors: [contributor("a", 1n), contributor("b", 1n), contributor("c", 1n)]
      })
    );

    expect(allocations).toEqual([
      { contributorId: "a", contributionMinorUnits: 1n, allocationMinorUnits: 34n },
      { contributorId: "b", contributionMinorUnits: 1n, allocationMinorUnits: 33n },
      { contributorId: "c", contributionMinorUnits: 1n, allocationMinorUnits: 33n }
    ]);
    expect(allocations.reduce((sum, entry) => sum + entry.allocationMinorUnits, 0n)).toBe(100n);
  });

  it("assigns the residual unit by largest remainder and preserves contributor order", () => {
    const allocations = expectOk(
      allocateRevenueShare({
        obligationMinorUnits: 10n,
        contributors: [contributor("second", 1n), contributor("first", 2n)]
      })
    );

    // 10 × 1 = 10 / 3 = 3 rem 1; 10 × 2 = 20 / 3 = 6 rem 2 → the larger remainder takes the unit.
    expect(allocations).toEqual([
      { contributorId: "second", contributionMinorUnits: 1n, allocationMinorUnits: 3n },
      { contributorId: "first", contributionMinorUnits: 2n, allocationMinorUnits: 7n }
    ]);
    expect(allocations.reduce((sum, entry) => sum + entry.allocationMinorUnits, 0n)).toBe(10n);
  });

  it("keeps the balanced total across an uneven contribution set", () => {
    const allocations = expectOk(
      allocateRevenueShare({
        obligationMinorUnits: 1_000_000n,
        contributors: [
          contributor("a", 7n),
          contributor("b", 11n),
          contributor("c", 13n),
          contributor("d", 3n)
        ]
      })
    );

    const total = allocations.reduce((sum, entry) => sum + entry.allocationMinorUnits, 0n);
    expect(total).toBe(1_000_000n);
    expect(allocations.map((entry) => entry.contributorId)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns one zero allocation per contributor when the obligation is zero", () => {
    const allocations = expectOk(
      allocateRevenueShare({
        obligationMinorUnits: 0n,
        contributors: [contributor("a", 5n), contributor("b", 3n)]
      })
    );

    expect(allocations).toEqual([
      { contributorId: "a", contributionMinorUnits: 5n, allocationMinorUnits: 0n },
      { contributorId: "b", contributionMinorUnits: 3n, allocationMinorUnits: 0n }
    ]);
  });

  it("returns an empty allocation list for a zero obligation with no contributors", () => {
    const allocations = expectOk(
      allocateRevenueShare({ obligationMinorUnits: 0n, contributors: [] })
    );

    expect(allocations).toEqual([]);
  });
});

describe("calculateRevenueShareDistribution", () => {
  it("composes obligation and allocations with a balanced total", () => {
    const distribution = expectOk(
      calculateRevenueShareDistribution({
        rule: demoRevenueShareRule,
        periods: [period("2026-08", DEMO_SALES_MINOR_UNITS, "reported")],
        contributors: [contributor("a", 1n), contributor("b", 1n), contributor("c", 1n)]
      })
    );

    expect(distribution.obligation.obligationMinorUnits).toBe(168_561n);
    expect(distribution.allocations).toHaveLength(3);
    expect(distribution.totalAllocatedMinorUnits).toBe(168_561n);
    expect(distribution.totalAllocatedMinorUnits).toBe(distribution.obligation.obligationMinorUnits);
  });

  it("returns a zero obligation with zero allocations when nothing is eligible", () => {
    const distribution = expectOk(
      calculateRevenueShareDistribution({
        rule: demoRevenueShareRule,
        periods: [period("2026-07", null, "missing")],
        contributors: [contributor("a", 2n)]
      })
    );

    expect(distribution.obligation.obligationMinorUnits).toBe(0n);
    expect(distribution.obligation.excludedPeriods).toEqual([
      { period: "2026-07", status: "missing", reason: "missing_data" }
    ]);
    expect(distribution.allocations).toEqual([
      { contributorId: "a", contributionMinorUnits: 2n, allocationMinorUnits: 0n }
    ]);
    expect(distribution.totalAllocatedMinorUnits).toBe(0n);
  });

  it("is deterministic: the same input yields deep-equal results", () => {
    const input = {
      rule: demoRevenueShareRule,
      periods: [
        period("2026-01", 1_234_567n, "reported"),
        period("2026-02", null, "missing"),
        period("2026-03", 987_654n, "anomalous")
      ],
      contributors: [contributor("a", 3n), contributor("b", 5n), contributor("c", 8n)]
    };

    expect(calculateRevenueShareDistribution(input)).toEqual(calculateRevenueShareDistribution(input));
  });
});

describe("rejections — sanitized error codes", () => {
  const reportedPeriod = [period("2026-08", DEMO_SALES_MINOR_UNITS, "reported")];

  it("rejects a rate of 0 basis points", () => {
    expectError(
      calculateRevenueShareObligation({ rule: ruleWith({ rateBps: 0 }), periods: reportedPeriod }),
      "invalid_rule"
    );
  });

  it("rejects a rate above 10000 basis points", () => {
    expectError(
      calculateRevenueShareObligation({ rule: ruleWith({ rateBps: 10_001 }), periods: reportedPeriod }),
      "invalid_rule"
    );
  });

  it("rejects a non-integer rate", () => {
    expectError(
      calculateRevenueShareObligation({ rule: ruleWith({ rateBps: 4.5 }), periods: reportedPeriod }),
      "invalid_rule"
    );
  });

  it("rejects an unknown rounding policy", () => {
    expectError(
      calculateRevenueShareObligation({
        rule: ruleWith({ rounding: "nearest" as unknown as RevenueShareRoundingPolicy }),
        periods: reportedPeriod
      }),
      "invalid_rule"
    );
  });

  it("rejects an empty rule version", () => {
    expectError(
      calculateRevenueShareObligation({ rule: ruleWith({ version: "  " }), periods: reportedPeriod }),
      "invalid_rule"
    );
  });

  it("rejects a reported period whose amount is null", () => {
    expectError(
      calculateRevenueShareObligation({
        rule: demoRevenueShareRule,
        periods: [period("2026-08", null, "reported")]
      }),
      "invalid_period"
    );
  });

  it("rejects an empty period label", () => {
    expectError(
      calculateRevenueShareObligation({
        rule: demoRevenueShareRule,
        periods: [period("", 100n, "reported")]
      }),
      "invalid_period"
    );
  });

  it("rejects a positive obligation with no contributors", () => {
    expectError(allocateRevenueShare({ obligationMinorUnits: 1n, contributors: [] }), "no_contributors");
  });

  it("rejects a zero contribution", () => {
    expectError(
      allocateRevenueShare({
        obligationMinorUnits: 10n,
        contributors: [contributor("a", 0n)]
      }),
      "invalid_contributor"
    );
  });

  it("rejects a negative contribution", () => {
    expectError(
      allocateRevenueShare({
        obligationMinorUnits: 10n,
        contributors: [contributor("a", -1n)]
      }),
      "invalid_contributor"
    );
  });

  it("rejects a duplicate contributor id", () => {
    expectError(
      allocateRevenueShare({
        obligationMinorUnits: 10n,
        contributors: [contributor("a", 1n), contributor("a", 2n)]
      }),
      "invalid_contributor"
    );
  });

  it("rejects an empty contributor id", () => {
    expectError(
      allocateRevenueShare({
        obligationMinorUnits: 10n,
        contributors: [contributor("   ", 1n)]
      }),
      "invalid_contributor"
    );
  });

  it("validates contributors before allocating through the distribution entry point", () => {
    expectError(
      calculateRevenueShareDistribution({
        rule: demoRevenueShareRule,
        periods: reportedPeriod,
        contributors: [contributor("a", 0n)]
      }),
      "invalid_contributor"
    );
  });

  it("validates periods before contributors through the distribution entry point", () => {
    expectError(
      calculateRevenueShareDistribution({
        rule: demoRevenueShareRule,
        periods: [period("2026-08", null, "reported")],
        contributors: [contributor("a", 1n)]
      }),
      "invalid_period"
    );
  });

  it("never throws and never leaks fields beyond the sanitized code", () => {
    const result = calculateRevenueShareObligation({
      rule: ruleWith({ rateBps: 0 }),
      periods: reportedPeriod
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.error)).toEqual(["code"]);
    }
  });
});

describe("type-level surface", () => {
  it("exposes the documented function signatures", () => {
    expectTypeOf(calculateRevenueShareObligation).returns.toEqualTypeOf<
      RevenueShareResult<RevenueShareObligation>
    >();
    expectTypeOf(calculateRevenueShareDistribution).returns.toMatchTypeOf<
      RevenueShareResult<unknown>
    >();
    expectTypeOf(allocateRevenueShare).returns.toMatchTypeOf<RevenueShareResult<unknown>>();
  });
});

describe("boundary and validation matrix (#87)", () => {
  const demoPeriods = [period("2026-08", DEMO_SALES_MINOR_UNITS, "reported")];

  describe("negative or malformed obligation (R3-allocator-unchecked-obligation)", () => {
    it("rejects a negative obligation with contributors instead of returning an unbalanced success", () => {
      expectError(
        allocateRevenueShare({
          obligationMinorUnits: -1n,
          contributors: [contributor("a", 1n), contributor("b", 1n)]
        }),
        "invalid_obligation"
      );
    });

    it("rejects a negative obligation with no contributors as invalid_obligation, not no_contributors", () => {
      expectError(
        allocateRevenueShare({ obligationMinorUnits: -1n, contributors: [] }),
        "invalid_obligation"
      );
    });

    it("rejects a non-bigint obligation cast at runtime", () => {
      expectError(
        allocateRevenueShare({
          obligationMinorUnits: 100 as unknown as bigint,
          contributors: [contributor("a", 1n)]
        }),
        "invalid_obligation"
      );
    });
  });

  describe("negative or malformed reported sales (R3-negative-sales-unvalidated)", () => {
    const negativeReportedSales = [period("2026-08", -1n, "reported")];
    const nonBigintReportedSales = [period("2026-08", 100 as unknown as bigint, "reported")];

    it("rejects a negative reported sales amount as invalid_period", () => {
      expectError(
        calculateRevenueShareObligation({
          rule: demoRevenueShareRule,
          periods: negativeReportedSales
        }),
        "invalid_period"
      );
    });

    it("reports invalid_period, not the misleading invalid_contributor, through the distribution entry point", () => {
      expectError(
        calculateRevenueShareDistribution({
          rule: demoRevenueShareRule,
          periods: negativeReportedSales,
          contributors: [contributor("a", 1n)]
        }),
        "invalid_period"
      );
    });

    it("rejects a non-bigint reported sales amount cast at runtime", () => {
      expectError(
        calculateRevenueShareObligation({
          rule: demoRevenueShareRule,
          periods: nonBigintReportedSales
        }),
        "invalid_period"
      );
    });
  });

  describe("frozen exported vocabulary (R3-unfrozen-exported-arrays)", () => {
    it("exposes the rounding policies and period statuses as runtime-frozen arrays", () => {
      expect(Object.isFrozen(revenueShareRoundingPolicies)).toBe(true);
      expect(Object.isFrozen(revenueSharePeriodStatuses)).toBe(true);
    });
  });

  describe("balanced-total invariant and determinism across a fixed matrix", () => {
    const allocationMatrix: ReadonlyArray<{
      readonly label: string;
      readonly obligationMinorUnits: bigint;
      readonly contributors: readonly RevenueShareContributor[];
    }> = [
      {
        label: "equal contributions",
        obligationMinorUnits: 100n,
        contributors: [contributor("a", 1n), contributor("b", 1n), contributor("c", 1n)]
      },
      {
        label: "uneven contributions",
        obligationMinorUnits: 1_000_000n,
        contributors: [
          contributor("a", 7n),
          contributor("b", 11n),
          contributor("c", 13n),
          contributor("d", 3n)
        ]
      },
      {
        label: "single contributor",
        obligationMinorUnits: 168_561n,
        contributors: [contributor("solo", 5n)]
      },
      {
        label: "obligation smaller than contributor count",
        obligationMinorUnits: 2n,
        contributors: [
          contributor("a", 1n),
          contributor("b", 1n),
          contributor("c", 1n),
          contributor("d", 1n),
          contributor("e", 1n)
        ]
      },
      {
        label: "obligation one unit below contributor count",
        obligationMinorUnits: 1n,
        contributors: [contributor("a", 1n), contributor("b", 1n)]
      }
    ];

    it.each(allocationMatrix)(
      "balances the total and preserves contributor count: $label",
      ({ obligationMinorUnits, contributors }) => {
        const allocations = expectOk(allocateRevenueShare({ obligationMinorUnits, contributors }));
        const total = allocations.reduce((sum, entry) => sum + entry.allocationMinorUnits, 0n);

        expect(allocations).toHaveLength(contributors.length);
        expect(total).toBe(obligationMinorUnits);
      }
    );

    it.each(allocationMatrix)(
      "is deterministic: $label yields deep-equal results on repeat calls",
      ({ obligationMinorUnits, contributors }) => {
        const first = allocateRevenueShare({ obligationMinorUnits, contributors });
        const second = allocateRevenueShare({ obligationMinorUnits, contributors });

        expect(first).toEqual(second);
      }
    );
  });

  it("breaks a largest-remainder tie toward the earlier contributor index", () => {
    // 1 × 1 = 1 / 2 = 0 remainder 1 for both contributors: equal remainders must not reorder.
    const allocations = expectOk(
      allocateRevenueShare({
        obligationMinorUnits: 1n,
        contributors: [contributor("first", 1n), contributor("second", 1n)]
      })
    );

    expect(allocations).toEqual([
      { contributorId: "first", contributionMinorUnits: 1n, allocationMinorUnits: 1n },
      { contributorId: "second", contributionMinorUnits: 1n, allocationMinorUnits: 0n }
    ]);
  });

  it("lets period status win over a non-null amount for exclusion", () => {
    const obligation = expectOk(
      calculateRevenueShareObligation({
        rule: demoRevenueShareRule,
        periods: [period("2026-01", 999n, "missing"), period("2026-02", 999n, "anomalous")]
      })
    );

    expect(obligation.eligiblePeriods).toEqual([]);
    expect(obligation.eligibleSalesMinorUnits).toBe(0n);
    expect(obligation.obligationMinorUnits).toBe(0n);
    expect(obligation.excludedPeriods).toEqual([
      { period: "2026-01", status: "missing", reason: "missing_data" },
      { period: "2026-02", status: "anomalous", reason: "requires_review" }
    ]);
  });

  it("keeps bigint precision beyond Number.MAX_SAFE_INTEGER using the floor definition", () => {
    const salesMinorUnits = 9_007_199_254_740_993n; // 2^53 + 1, not exactly representable as a number

    const obligation = expectOk(
      calculateRevenueShareObligation({
        rule: demoRevenueShareRule,
        periods: [period("2026-08", salesMinorUnits, "reported")]
      })
    );

    const numerator = salesMinorUnits * 450n;
    const computed = obligation.obligationMinorUnits;

    // Floor definition: computed is the largest integer n with n × 10000 <= sales × 450.
    expect(computed * 10_000n <= numerator).toBe(true);
    expect(computed * 10_000n + 10_000n > numerator).toBe(true);
    // Pinned literal verified independently of the engine.
    expect(computed).toBe(405_323_966_463_344n);
  });

  it("resolves the exact .5 remainder boundary as floor 0 and half_up 1", () => {
    const periods = [period("2026-01", 1n, "reported")];

    const floored = expectOk(
      calculateRevenueShareObligation({
        rule: ruleWith({ rateBps: 5000, rounding: "floor" }),
        periods
      })
    );
    const halfUp = expectOk(
      calculateRevenueShareObligation({
        rule: ruleWith({ rateBps: 5000, rounding: "half_up" }),
        periods
      })
    );

    expect(floored.obligationMinorUnits).toBe(0n);
    expect(halfUp.obligationMinorUnits).toBe(1n);
  });

  it("rejects an unknown runtime period status as invalid_period", () => {
    expectError(
      calculateRevenueShareObligation({
        rule: demoRevenueShareRule,
        periods: [
          {
            period: "2026-08",
            salesMinorUnits: 100n,
            status: "estimated" as unknown as RevenueSharePeriod["status"]
          }
        ]
      }),
      "invalid_period"
    );
  });

  it("rejects NaN and Infinity rates as invalid_rule", () => {
    expectError(
      calculateRevenueShareObligation({ rule: ruleWith({ rateBps: Number.NaN }), periods: demoPeriods }),
      "invalid_rule"
    );
    expectError(
      calculateRevenueShareObligation({
        rule: ruleWith({ rateBps: Number.POSITIVE_INFINITY }),
        periods: demoPeriods
      }),
      "invalid_rule"
    );
  });

  it("rejects contributor ids that collide after trimming surrounding whitespace", () => {
    expectError(
      allocateRevenueShare({
        obligationMinorUnits: 10n,
        contributors: [contributor("a", 1n), contributor(" a", 2n)]
      }),
      "invalid_contributor"
    );
  });

  it("treats an empty period list as a zero obligation with no error", () => {
    const obligation = expectOk(
      calculateRevenueShareObligation({ rule: demoRevenueShareRule, periods: [] })
    );

    expect(obligation.eligiblePeriods).toEqual([]);
    expect(obligation.excludedPeriods).toEqual([]);
    expect(obligation.eligibleSalesMinorUnits).toBe(0n);
    expect(obligation.obligationMinorUnits).toBe(0n);
  });

  it("distributes a zero obligation as all-zero allocations with a zero total", () => {
    const distribution = expectOk(
      calculateRevenueShareDistribution({
        rule: demoRevenueShareRule,
        periods: [],
        contributors: [contributor("a", 2n), contributor("b", 3n)]
      })
    );

    expect(distribution.obligation.obligationMinorUnits).toBe(0n);
    expect(distribution.allocations).toEqual([
      { contributorId: "a", contributionMinorUnits: 2n, allocationMinorUnits: 0n },
      { contributorId: "b", contributionMinorUnits: 3n, allocationMinorUnits: 0n }
    ]);
    expect(distribution.totalAllocatedMinorUnits).toBe(0n);
  });
});

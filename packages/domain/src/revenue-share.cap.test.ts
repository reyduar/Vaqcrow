import { describe, expect, it } from "vitest";
import { allocateRevenueShare, calculateRevenueShareDistribution, demoRevenueShareRule } from "./revenue-share.js";
import type { RevenueShareContributor } from "./revenue-share.js";

/**
 * The 1.5x cap, as durable regression coverage (#580).
 *
 * These probes were written by the independent verifier over the cap's commit, not by the
 * author: they are the falsification attempt that failed to find a blocker, kept as a test so
 * the property stays pinned. The invariant they assert is the one the cap exists to establish —
 * no investor is ever paid past `floor(contribution x 3 / 2)`, and the pool is neither
 * over- nor under-distributed.
 */

const cap = (c: bigint): bigint => (c * 3n) / 2n;
const remaining = (c: bigint, d: bigint): bigint => (cap(c) > d ? cap(c) - d : 0n);
const contributor = (id: string, c: bigint, d: bigint): RevenueShareContributor => ({
  contributorId: id,
  contributionMinorUnits: c,
  distributedMinorUnits: d
});

function check(obligation: bigint, cs: readonly RevenueShareContributor[]): void {
  const r = allocateRevenueShare({
    rule: demoRevenueShareRule,
    obligationMinorUnits: obligation,
    contributors: cs
  });
  const sumRemaining = cs.reduce((s, x) => s + remaining(x.contributionMinorUnits, x.distributedMinorUnits), 0n);
  const expected = obligation < sumRemaining ? obligation : sumRemaining;

  if (!r.ok) throw new Error(`unexpected error ${r.error.code}`);

  expect(r.value.totalAllocatedMinorUnits).toBe(expected);
  expect(r.value.allocations.reduce((s, a) => s + a.allocationMinorUnits, 0n)).toBe(expected);

  let anyCapacity = false;
  for (const orig of cs) {
    const paid = r.value.allocations.find((x) => x.contributorId === orig.contributorId)?.allocationMinorUnits;
    expect(typeof paid).toBe("bigint");
    expect(paid ?? 0n).toBeLessThanOrEqual(remaining(orig.contributionMinorUnits, orig.distributedMinorUnits));
    if (orig.distributedMinorUnits <= cap(orig.contributionMinorUnits)) {
      expect(orig.distributedMinorUnits + (paid ?? 0n)).toBeLessThanOrEqual(cap(orig.contributionMinorUnits));
    }
    if (remaining(orig.contributionMinorUnits, orig.distributedMinorUnits) > 0n) anyCapacity = true;
  }

  expect(r.value.agreementComplete).toBe(!anyCapacity);
}

describe("the 1.5x cap (#580)", () => {
  it("holds across an exhaustive grid", { timeout: 60_000 }, () => {
    for (let ob = 0n; ob <= 40n; ob += 1n) {
      for (let cA = 1n; cA <= 6n; cA += 1n) {
        for (let dA = 0n; dA <= cap(cA) + 1n; dA += 1n) {
          for (let cB = 1n; cB <= 6n; cB += 1n) {
            for (let dB = 0n; dB <= cap(cB) + 1n; dB += 1n) {
              check(ob, [contributor("A", cA, dA), contributor("B", cB, dB)]);
            }
          }
        }
      }
    }
  });

  it("holds for three contributors over a seeded fuzz", () => {
    let seed = 123456789n;
    const rnd = (max: bigint): bigint => {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
      return seed % max;
    };

    for (let i = 0; i < 5000; i += 1) {
      const cs = ["A", "B", "C"].map((id) => {
        const c = rnd(10_000_000_000n) + 1n;
        return contributor(id, c, rnd(cap(c) + 3n));
      });
      check(rnd(20_000_000_000n), cs);
    }
  });

  it("truncates a non-integer 1.5x at floor", () => {
    expect(cap(3n)).toBe(4n);

    const run = (d: bigint) => {
      const x = allocateRevenueShare({
        rule: demoRevenueShareRule,
        obligationMinorUnits: 1_000n,
        contributors: [contributor("A", 3n, d)]
      });
      if (!x.ok) throw new Error(`unexpected error ${x.error.code}`);
      return x.value;
    };

    expect(run(3n).allocations[0]?.allocationMinorUnits).toBe(1n);
    expect(run(0n).allocations[0]?.allocationMinorUnits).toBe(4n);
    expect(run(4n).allocations[0]?.allocationMinorUnits).toBe(0n);
  });

  it("redistributes the truncated remainder, never losing it", () => {
    const x = allocateRevenueShare({
      rule: demoRevenueShareRule,
      obligationMinorUnits: 10_000n,
      contributors: [contributor("A", 100n, 149n), contributor("B", 9_900n, 0n)]
    });
    if (!x.ok) throw new Error(`unexpected error ${x.error.code}`);

    const a = x.value.allocations.find((v) => v.contributorId === "A")?.allocationMinorUnits ?? 0n;
    const b = x.value.allocations.find((v) => v.contributorId === "B")?.allocationMinorUnits ?? 0n;

    expect(a).toBe(1n);
    expect(a + 149n).toBe(150n);
    expect(a + b).toBe(10_000n);
  });

  it("cannot be bypassed by a huge obligation", () => {
    const x = allocateRevenueShare({
      rule: demoRevenueShareRule,
      obligationMinorUnits: 10n ** 30n,
      contributors: [contributor("A", 10n, 0n), contributor("B", 4n, 0n)]
    });
    if (!x.ok) throw new Error(`unexpected error ${x.error.code}`);

    expect(x.value.totalAllocatedMinorUnits).toBe(21n);
  });

  it("enforces the same cap through calculateRevenueShareDistribution", () => {
    const x = calculateRevenueShareDistribution({
      rule: demoRevenueShareRule,
      periods: [{ period: "2026-08", salesMinorUnits: 100_000_000n, status: "reported" }],
      contributors: [contributor("A", 100n, 149n), contributor("B", 10_000n, 0n)]
    });
    if (!x.ok) throw new Error(`unexpected error ${x.error.code}`);

    expect(x.value.allocations.find((v) => v.contributorId === "A")?.allocationMinorUnits).toBe(1n);
    expect(x.value.allocations.find((v) => v.contributorId === "B")?.allocationMinorUnits).toBe(15_000n);
  });

  it("rejects a negative accumulator and a negative obligation", () => {
    expect(
      allocateRevenueShare({
        rule: demoRevenueShareRule,
        obligationMinorUnits: 100n,
        contributors: [contributor("A", 10n, -1n)]
      })
    ).toEqual({ ok: false, error: { code: "invalid_contributor" } });

    expect(
      allocateRevenueShare({
        rule: demoRevenueShareRule,
        obligationMinorUnits: -1n,
        contributors: [contributor("A", 10n, 0n)]
      })
    ).toEqual({ ok: false, error: { code: "invalid_obligation" } });
  });
});

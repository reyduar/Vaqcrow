import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASSESSMENT_RETRY_POLICY,
  backoffMs,
  isRetryableAssessmentFailure
} from "./index.js";
import type { AssessmentRetryPolicy } from "./index.js";

/**
 * Focused behaviour for the bounded retry policy (Feature #31, WU2).
 *
 * The policy is the single owner of two decisions the assessment boundary must
 * not scatter: how long to wait between attempts, and which failures are worth
 * another attempt. This suite pins the arithmetic and the truth table, because
 * both are the kind of "obvious" code that silently drifts.
 */

describe("DEFAULT_ASSESSMENT_RETRY_POLICY", () => {
  it("retries once, quickly and bounded", () => {
    expect(DEFAULT_ASSESSMENT_RETRY_POLICY).toEqual({
      maxAttempts: 2,
      initialBackoffMs: 500,
      maxBackoffMs: 4_000
    });
  });
});

describe("backoffMs", () => {
  const POLICY: AssessmentRetryPolicy = {
    maxAttempts: 5,
    initialBackoffMs: 500,
    maxBackoffMs: 4_000
  };

  it("returns the initial backoff on the first attempt", () => {
    expect(backoffMs(1, POLICY)).toBe(500);
  });

  it("doubles with each attempt", () => {
    expect(backoffMs(2, POLICY)).toBe(1_000);
    expect(backoffMs(3, POLICY)).toBe(2_000);
    expect(backoffMs(4, POLICY)).toBe(4_000);
  });

  it("caps the delay at maxBackoffMs instead of growing without bound", () => {
    expect(backoffMs(5, POLICY)).toBe(4_000);
    expect(backoffMs(50, POLICY)).toBe(4_000);
  });

  it("clamps a non-positive attempt to the initial backoff rather than shrinking below it", () => {
    expect(backoffMs(0, POLICY)).toBe(500);
    expect(backoffMs(-10, POLICY)).toBe(500);
  });

  it("never overflows to Infinity when the exponent is clamped", () => {
    // Without the clamp, 2 ** attempt overflows to Infinity and Math.min would
    // happily return that as a delay. The cap must survive an absurd attempt.
    expect(Number.isFinite(backoffMs(100_000, POLICY))).toBe(true);
    expect(backoffMs(100_000, POLICY)).toBe(4_000);
  });

  it("honours a different policy's initial backoff and ceiling", () => {
    const policy: AssessmentRetryPolicy = {
      maxAttempts: 3,
      initialBackoffMs: 100,
      maxBackoffMs: 250
    };

    expect(backoffMs(1, policy)).toBe(100);
    expect(backoffMs(2, policy)).toBe(200);
    expect(backoffMs(3, policy)).toBe(250);
    expect(backoffMs(4, policy)).toBe(250);
  });

  it("supports a zero-delay policy so a test needs no real wait", () => {
    const immediate: AssessmentRetryPolicy = {
      maxAttempts: 2,
      initialBackoffMs: 0,
      maxBackoffMs: 0
    };

    expect(backoffMs(1, immediate)).toBe(0);
    expect(backoffMs(2, immediate)).toBe(0);
  });
});

describe("isRetryableAssessmentFailure", () => {
  it("retries only provider_unavailable: a transient break is worth another attempt", () => {
    expect(isRetryableAssessmentFailure("provider_unavailable")).toBe(true);
  });

  it("never retries timeout: a slow model is not fixed by waiting again", () => {
    expect(isRetryableAssessmentFailure("timeout")).toBe(false);
  });
});

/**
 * The bounded retry policy and failure classification the provider-independent
 * assessment boundary shares.
 *
 * It exists because "retry the provider call" is two decisions — how long to
 * wait and which failures deserve another attempt — and scattering them across
 * the caller makes them drift. The policy is dependency-free on purpose (it
 * holds only the shape and arithmetic over it), so the boundary can name it
 * without the module reaching for a provider, a clock or anything node-specific.
 * The sibling `confirmation-policy.ts` in `apps/api` is the same idea for the
 * Stellar confirmation loops.
 */

export interface AssessmentRetryPolicy {
  /** Total attempts, including the first. 1 means no retry. */
  readonly maxAttempts: number;
  /** The delay before the first retry, in milliseconds. */
  readonly initialBackoffMs: number;
  /** The ceiling the delay doubles towards, so a slow provider is not waited on forever. */
  readonly maxBackoffMs: number;
}

/**
 * One retry, fast failures only (owner, 2026-10-11).
 *
 * A transient break is worth exactly one more attempt; the delay is short
 * because a provider that is merely unavailable usually recovers quickly, and a
 * bounded ceiling keeps a chain of retries from turning one request into a long
 * stall.
 */
export const DEFAULT_ASSESSMENT_RETRY_POLICY: AssessmentRetryPolicy = {
  maxAttempts: 2,
  initialBackoffMs: 500,
  maxBackoffMs: 4_000
};

/**
 * Doubles from the first retry and stops at the ceiling.
 *
 * The exponent is clamped before the multiplication so an absurd attempt cannot
 * overflow into `Infinity` — which `Math.min` would then accept as the delay,
 * producing a timer that never fires rather than a schedule.
 */
export function backoffMs(attempt: number, policy: AssessmentRetryPolicy): number {
  const doublings = Math.min(Math.max(attempt - 1, 0), 30);

  return Math.min(policy.initialBackoffMs * 2 ** doublings, policy.maxBackoffMs);
}

/**
 * Classifies a sanitized provider failure as worth another attempt.
 *
 * `provider_unavailable` is a fast, transient break: the provider was reachable
 * but could not answer, so asking once more can succeed. `timeout` is terminal —
 * a model that is too slow is not fixed by waiting again, and retrying it would
 * only double the wait for the same non-answer.
 */
export function isRetryableAssessmentFailure(
  code: "timeout" | "provider_unavailable"
): boolean {
  return code === "provider_unavailable";
}

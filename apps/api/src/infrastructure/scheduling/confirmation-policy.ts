/**
 * The one confirmation policy and backoff arithmetic both confirmation loops
 * share.
 *
 * The funding-intent and revenue-share distribution loops advance records that
 * are waiting on the same network, so they must retry on the same schedule. The
 * policy and the arithmetic used to live inside each use case, which meant a
 * change to one copy could silently leave the other behind; this module is the
 * single owner so they cannot drift. It is dependency-free on purpose — it holds
 * only the policy shape and the arithmetic over it — so both the application use
 * cases and the infrastructure scheduler can name it without either owning it.
 */

export interface ConfirmationPolicy {
  /** The most intents one step may touch. */
  readonly batchSize: number;
  /** The delay before the first retry, in milliseconds. */
  readonly initialBackoffMs: number;
  /** The ceiling the delay doubles towards, so load stops growing. */
  readonly maxBackoffMs: number;
}

/**
 * Testnet closes a ledger roughly every five seconds, so the first retry is
 * spaced to give a submission a chance to land before asking again.
 */
export const DEFAULT_CONFIRMATION_POLICY: ConfirmationPolicy = {
  batchSize: 20,
  initialBackoffMs: 5_000,
  maxBackoffMs: 60_000
};

/**
 * How often the loop wakes.
 *
 * Testnet closes a ledger roughly every five seconds, so waking on that cadence
 * means a confirmation is noticed about as soon as it can exist — and the loop
 * itself costs nothing when there is nothing to confirm, because an empty tick is
 * one indexed query.
 */
export const DEFAULT_CONFIRMATION_INTERVAL_MS = 5_000;

/**
 * Doubles from the first retry and stops at the ceiling.
 *
 * The exponent is clamped before the multiplication so a long-lived intent cannot
 * overflow into `Infinity` — which `Math.min` would then happily accept as the
 * delay, producing an `Invalid Date` rather than a schedule.
 */
export function backoffMs(attempts: number, policy: ConfirmationPolicy): number {
  const doublings = Math.min(Math.max(attempts - 1, 0), 30);

  return Math.min(policy.initialBackoffMs * 2 ** doublings, policy.maxBackoffMs);
}

import type { CorrelationId } from "@vaqcrow/contracts";
import type {
  FundingIntentConfirmation,
  FundingIntentRecord,
  FundingIntentRepositoryPort
} from "../ports/funding-intent-repository-port.js";
import type { StellarTransactionPort } from "../ports/stellar-transaction-port.js";

/**
 * Advances every funding intent still awaiting an outcome by exactly one step.
 *
 * This is the whole confirmation capability in one pure function: it takes the
 * instant it is running at, reads the intents that are due, and moves each of
 * them at most one step. It owns no timer and no process, which is what makes the
 * bound and the resumption testable rather than observed — the schedule lives in
 * the database (`next_attempt_at`), so a restart resumes rather than restarts.
 *
 * **Why it submits on every step instead of tracking whether it already has.**
 * The obvious design keeps a local "already handed over" flag and skips the
 * submission on later steps. That flag would be derived state: stellar-core
 * already knows whether it holds the transaction, and it says so — `DUPLICATE` is
 * exactly that answer. Re-deriving it locally would duplicate the provider's own
 * state, and the copy could be wrong (a write that failed, a transaction core
 * dropped) while the provider's answer cannot. Re-offering the envelope is also
 * what a payment system is supposed to do: it keeps the transaction alive in
 * core's queue until it is included or its `maxTime` passes. The cost is one
 * extra Horizon call per pending intent per step, and `checkMemoRequired`
 * short-circuits whenever the intent carries a memo.
 *
 * **What "bounded" means here, concretely.** Three things, and none of them is an
 * attempt cap:
 *   * the batch size, so one step cannot sweep an unbounded number of intents;
 *   * the backoff, so a long-lived intent is checked at a widening interval that
 *     stops widening — the load does not grow with the attempt count;
 *   * the envelope's own `maxTime`, which is a *real* bound rather than a policy
 *     number: after it, Stellar can never include the transaction, so the intent
 *     is terminally `expired`.
 *
 * An attempt cap is deliberately absent. Reaching one would leave an intent in
 * `submitted` with nothing left to do, and the vocabulary has no honest state for
 * "Vaqcrow stopped asking" — `manual_review` belongs to the production roadmap
 * (D2), and inventing a fourth state to record our own impatience would describe
 * Vaqcrow rather than the transaction.
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

export interface ConfirmFundingIntentsDeps {
  /**
   * Only the three operations a step performs. `submit` and `findById` are the
   * HTTP surface's business, and depending on the whole port would oblige this
   * use case to know about a write it must never make.
   */
  readonly repository: Pick<
    FundingIntentRepositoryPort,
    "findPending" | "recordAttempt" | "recordConfirmation"
  >;
  readonly transaction: StellarTransactionPort;
}

/**
 * What one step did to one intent. `deferred` means the network has not decided
 * yet and the intent keeps its state; `unavailable` means the step could not
 * conclude anything, including when a write of its own failed.
 */
export type FundingIntentConfirmationResult = "confirmed" | "failed" | "deferred" | "unavailable";

export interface FundingIntentConfirmationStep {
  readonly intentId: string;
  readonly result: FundingIntentConfirmationResult;
}

export type ConfirmFundingIntentsResult =
  | { readonly ok: true; readonly value: readonly FundingIntentConfirmationStep[] }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function confirmFundingIntents(
  deps: ConfirmFundingIntentsDeps,
  input: {
    readonly now: string;
    readonly correlationId: CorrelationId;
    readonly policy: ConfirmationPolicy;
  }
): Promise<ConfirmFundingIntentsResult> {
  const pending = await deps.repository.findPending({
    now: input.now,
    limit: input.policy.batchSize
  });

  if (!pending.ok) {
    // An unreachable database and an empty queue are different facts. Collapsing
    // them would hide an outage behind a quiet success.
    return { ok: false, error: { code: "unavailable" } };
  }

  const steps: FundingIntentConfirmationStep[] = [];

  // Sequential on purpose: the batch is small, and a step that throws for one
  // intent must not abandon the others or leave their outcome unreported.
  for (const intent of pending.value) {
    steps.push(await advance(deps, intent, input));
  }

  return { ok: true, value: steps };
}

async function advance(
  deps: ConfirmFundingIntentsDeps,
  intent: FundingIntentRecord,
  input: {
    readonly now: string;
    readonly correlationId: CorrelationId;
    readonly policy: ConfirmationPolicy;
  }
): Promise<FundingIntentConfirmationStep> {
  // The hard bound, checked first because it is the one conclusion that does not
  // need the network: after `maxTime`, Stellar can never include the envelope.
  if (Date.parse(input.now) >= Date.parse(intent.expiresAt)) {
    return conclude(deps, intent, { outcome: "failed", reason: "expired" }, "failed", input.correlationId);
  }

  const submitted = await deps.transaction.submit(intent.signedXdr);

  if (!submitted.ok) {
    return submitted.error.code === "invalid_input"
      ? // The envelope cannot be decoded, so retrying it retries the same
        // malformed record forever. That is terminal, not transient.
        conclude(deps, intent, { outcome: "failed", reason: "unsuccessful" }, "failed", input.correlationId)
      : defer(deps, intent, input, "unavailable");
  }

  if (submitted.value.status === "rejected") {
    // Core refused it, so it will never reach a ledger. Nothing to look up.
    return conclude(
      deps,
      intent,
      { outcome: "failed", reason: submitted.value.reason },
      "failed",
      input.correlationId
    );
  }

  const found = await deps.transaction.findTransaction(intent.transactionHash);

  if (!found.ok) {
    return defer(deps, intent, input, "unavailable");
  }

  switch (found.value.status) {
    case "confirmed":
      return conclude(
        deps,
        intent,
        {
          outcome: "confirmed",
          ledgerSequence: found.value.ledgerSequence,
          confirmedAt: found.value.confirmedAt
        },
        "confirmed",
        input.correlationId
      );
    case "failed":
      return conclude(
        deps,
        intent,
        { outcome: "failed", reason: found.value.reason },
        "failed",
        input.correlationId
      );
    case "pending":
      return defer(deps, intent, input, "deferred");
  }
}

/**
 * Writes a terminal outcome.
 *
 * A failed write is reported as `unavailable` rather than as the outcome it
 * failed to record: the next step re-derives the same conclusion from Horizon and
 * tries again, and the conditional update makes that retry a non-application
 * instead of a double-apply. Claiming a conclusion the database never accepted
 * would be the one dishonest option.
 */
async function conclude(
  deps: ConfirmFundingIntentsDeps,
  intent: FundingIntentRecord,
  confirmation: FundingIntentConfirmation,
  result: FundingIntentConfirmationResult,
  correlationId: CorrelationId
): Promise<FundingIntentConfirmationStep> {
  const written = await deps.repository.recordConfirmation({
    intentId: intent.intentId,
    confirmation,
    correlationId
  });

  return { intentId: intent.intentId, result: written.ok ? result : "unavailable" };
}

/** Moves the schedule forward without moving the state, and counts the attempt. */
async function defer(
  deps: ConfirmFundingIntentsDeps,
  intent: FundingIntentRecord,
  input: {
    readonly now: string;
    readonly correlationId: CorrelationId;
    readonly policy: ConfirmationPolicy;
  },
  result: FundingIntentConfirmationResult
): Promise<FundingIntentConfirmationStep> {
  const attempts = intent.confirmationAttempts + 1;

  const written = await deps.repository.recordAttempt({
    intentId: intent.intentId,
    attempts,
    nextAttemptAt: new Date(
      Date.parse(input.now) + backoffMs(attempts, input.policy)
    ).toISOString(),
    correlationId: input.correlationId
  });

  return { intentId: intent.intentId, result: written.ok ? result : "unavailable" };
}

/**
 * Doubles from the first retry and stops at the ceiling.
 *
 * The exponent is clamped before the multiplication so a long-lived intent cannot
 * overflow into `Infinity` — which `Math.min` would then happily accept as the
 * delay, producing an `Invalid Date` rather than a schedule.
 */
function backoffMs(attempts: number, policy: ConfirmationPolicy): number {
  const doublings = Math.min(Math.max(attempts - 1, 0), 30);

  return Math.min(policy.initialBackoffMs * 2 ** doublings, policy.maxBackoffMs);
}

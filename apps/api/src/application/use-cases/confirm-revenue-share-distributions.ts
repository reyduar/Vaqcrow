import type { CorrelationId } from "@vaqcrow/contracts";
import { backoffMs } from "../../infrastructure/scheduling/confirmation-policy.js";
import type { ConfirmationPolicy } from "../../infrastructure/scheduling/confirmation-policy.js";
import type {
  RevenueShareDistributionConfirmation,
  RevenueShareDistributionRecord,
  RevenueShareDistributionRepositoryPort
} from "../ports/revenue-share-distribution-repository-port.js";
import type { StellarTransactionPort } from "../ports/stellar-transaction-port.js";

/**
 * Advances every revenue-share distribution still awaiting an outcome by exactly
 * one step.
 *
 * This is the distribution counterpart of `confirmFundingIntents`, and it keeps
 * the same shape on purpose: it takes the instant it is running at, reads the
 * distributions that are due, and moves each of them at most one step. It owns
 * no timer and no process, which is what makes the bound and the resumption
 * testable rather than observed — the schedule lives in the database
 * (`next_attempt_at`), so a restart resumes rather than restarts.
 *
 * **Why it submits on every step instead of tracking whether it already has.**
 * The same reason as the funding intent: stellar-core already knows whether it
 * holds the transaction, and it says so — `DUPLICATE` is exactly that answer.
 * Re-deriving that locally would duplicate the provider's own state, and the copy
 * could be wrong while the provider's answer cannot. Re-offering the envelope is
 * also what a payment system is supposed to do: it keeps the transaction alive
 * in core's queue until it is included or its `maxTime` passes.
 *
 * **What "bounded" means here, concretely.** The batch size bounds one step; the
 * backoff widens towards a ceiling so load does not grow with the attempt count;
 * and the envelope's own `maxTime` is the real bound — after it, Stellar can
 * never include the transaction, so the distribution is terminally `expired`. An
 * attempt cap is deliberately absent, exactly as for the funding intent: reaching
 * one would leave a distribution `submitted` with nothing left to do, and the
 * vocabulary has no honest state for "Vaqcrow stopped asking".
 */

export interface ConfirmRevenueShareDistributionsDeps {
  /**
   * Only the three operations a step performs. `submit` and `findById` are the
   * HTTP surface's business, and depending on the whole port would oblige this
   * use case to know about a write it must never make.
   */
  readonly repository: Pick<
    RevenueShareDistributionRepositoryPort,
    "findPending" | "recordAttempt" | "recordConfirmation"
  >;
  readonly transaction: StellarTransactionPort;
}

/**
 * What one step did to one distribution. `deferred` means the network has not
 * decided yet and the distribution keeps its state; `unavailable` means the step
 * could not conclude anything, including when a write of its own failed.
 */
export type RevenueShareDistributionConfirmationResult =
  | "confirmed"
  | "failed"
  | "deferred"
  | "unavailable";

export interface RevenueShareDistributionConfirmationStep {
  readonly distributionId: string;
  readonly result: RevenueShareDistributionConfirmationResult;
}

export type ConfirmRevenueShareDistributionsResult =
  | { readonly ok: true; readonly value: readonly RevenueShareDistributionConfirmationStep[] }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function confirmRevenueShareDistributions(
  deps: ConfirmRevenueShareDistributionsDeps,
  input: {
    readonly now: string;
    readonly correlationId: CorrelationId;
    readonly policy: ConfirmationPolicy;
  }
): Promise<ConfirmRevenueShareDistributionsResult> {
  const pending = await deps.repository.findPending({
    now: input.now,
    limit: input.policy.batchSize
  });

  if (!pending.ok) {
    // An unreachable database and an empty queue are different facts. Collapsing
    // them would hide an outage behind a quiet success.
    return { ok: false, error: { code: "unavailable" } };
  }

  const steps: RevenueShareDistributionConfirmationStep[] = [];

  // Sequential on purpose: the batch is small, and a step that throws for one
  // distribution must not abandon the others or leave their outcome unreported.
  for (const distribution of pending.value) {
    steps.push(await advance(deps, distribution, input));
  }

  return { ok: true, value: steps };
}

async function advance(
  deps: ConfirmRevenueShareDistributionsDeps,
  distribution: RevenueShareDistributionRecord,
  input: {
    readonly now: string;
    readonly correlationId: CorrelationId;
    readonly policy: ConfirmationPolicy;
  }
): Promise<RevenueShareDistributionConfirmationStep> {
  // The hard bound, checked first because it is the one conclusion that does not
  // need the network: after `maxTime`, Stellar can never include the envelope.
  if (Date.parse(input.now) >= Date.parse(distribution.expiresAt)) {
    return conclude(
      deps,
      distribution,
      { outcome: "failed", reason: "expired" },
      "failed",
      input.correlationId
    );
  }

  const submitted = await deps.transaction.submit(distribution.signedXdr);

  if (!submitted.ok) {
    return submitted.error.code === "invalid_input"
      ? // The envelope cannot be decoded, so retrying it retries the same
        // malformed record forever. That is terminal, not transient.
        conclude(
          deps,
          distribution,
          { outcome: "failed", reason: "unsuccessful" },
          "failed",
          input.correlationId
        )
      : defer(deps, distribution, input, "unavailable");
  }

  if (submitted.value.status === "rejected") {
    // Core refused it, so it will never reach a ledger. Nothing to look up. The
    // reason is already the closed vocabulary the port promises, so it never
    // carries Horizon's raw code.
    return conclude(
      deps,
      distribution,
      { outcome: "failed", reason: submitted.value.reason },
      "failed",
      input.correlationId
    );
  }

  const found = await deps.transaction.findTransaction(distribution.transactionHash);

  if (!found.ok) {
    return defer(deps, distribution, input, "unavailable");
  }

  switch (found.value.status) {
    case "confirmed":
      return conclude(
        deps,
        distribution,
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
        distribution,
        { outcome: "failed", reason: found.value.reason },
        "failed",
        input.correlationId
      );
    case "pending":
      return defer(deps, distribution, input, "deferred");
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
  deps: ConfirmRevenueShareDistributionsDeps,
  distribution: RevenueShareDistributionRecord,
  confirmation: RevenueShareDistributionConfirmation,
  result: RevenueShareDistributionConfirmationResult,
  correlationId: CorrelationId
): Promise<RevenueShareDistributionConfirmationStep> {
  const written = await deps.repository.recordConfirmation({
    distributionId: distribution.distributionId,
    confirmation,
    correlationId
  });

  return { distributionId: distribution.distributionId, result: written.ok ? result : "unavailable" };
}

/** Moves the schedule forward without moving the state, and counts the attempt. */
async function defer(
  deps: ConfirmRevenueShareDistributionsDeps,
  distribution: RevenueShareDistributionRecord,
  input: {
    readonly now: string;
    readonly correlationId: CorrelationId;
    readonly policy: ConfirmationPolicy;
  },
  result: RevenueShareDistributionConfirmationResult
): Promise<RevenueShareDistributionConfirmationStep> {
  const attempts = distribution.confirmationAttempts + 1;

  const written = await deps.repository.recordAttempt({
    distributionId: distribution.distributionId,
    attempts,
    nextAttemptAt: new Date(
      Date.parse(input.now) + backoffMs(attempts, input.policy)
    ).toISOString(),
    correlationId: input.correlationId
  });

  return {
    distributionId: distribution.distributionId,
    result: written.ok ? result : "unavailable"
  };
}

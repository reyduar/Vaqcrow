import type {
  CorrelationId,
  DistributionRecipient,
  RevenueShareDistributionState
} from "@vaqcrow/contracts";

/**
 * The distribution state machine, as the demo can produce it, re-exported so a
 * caller of this port does not have to reach into `@vaqcrow/contracts` for the
 * one type that names a persisted state.
 */
export type { RevenueShareDistributionState };

/**
 * Persists a submitted revenue-share distribution, moves it through
 * confirmation, and reads it back.
 *
 * This is the distribution counterpart of `FundingIntentRepositoryPort`, and it
 * keeps the same shape on purpose (`D3`): a distribution is financial evidence
 * keyed on `transaction_hash`, with the same idempotent `submit`, the same
 * bounded-resumable scheduling reads, and the same closed error vocabulary. A
 * verified submission may only ever *create* a row; the only thing a transition
 * may move is `state` and the confirmation evidence that goes with it, enforced
 * at the database by a column-scoped grant rather than by the adapter
 * remembering to behave.
 *
 * What is different is the money. A distribution is **one transaction, one
 * native payment per recipient** (`D2`), so the financial facts are a list
 * rather than a single `destinationAccountId`/`amountStroops` pair. That list
 * lives in immutable child rows, read back in `position` order and returned
 * exactly as `(accountId, amountStroops)`.
 *
 * The shapes here are plain data. Nothing in this file imports the Supabase or
 * Stellar SDKs, so `application/` stays provider-free by construction and the
 * adapter owns every encoding decision. Timestamps cross this boundary as ISO
 * strings and amounts as `bigint` stroops, matching
 * `BuiltRevenueShareDistributionXdr`/`VerifiedRevenueShareDistributionXdr` so a
 * built/verified pair maps onto a submission without a numeric conversion in
 * between.
 */

export type RevenueShareDistributionRepositoryErrorCode =
  | "not_found"
  | "idempotency_conflict"
  | "unavailable";

export interface RevenueShareDistributionRepositoryError {
  readonly code: RevenueShareDistributionRepositoryErrorCode;
}

export type RevenueShareDistributionRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RevenueShareDistributionRepositoryError };

/**
 * The facts a *verified* submission persists, supplied by the use case.
 *
 * `state`, `createdAt` and `updatedAt` are deliberately absent: they are
 * server-owned facts, set by the adapter and the database, never by a caller.
 * `lastCorrelationId` is likewise absent because it arrives as the separate
 * `correlationId` argument.
 *
 * `network` and `networkPassphrase` are both persisted rather than inferred: the
 * passphrase is what a signature commits to and the network name is what a human
 * reads later, and neither is derivable from the other without a lookup table.
 *
 * `transactionHash` is the payload fingerprint and is what idempotency keys on —
 * the signature bytes may legitimately vary over the same hash, so the hash, not
 * the signed envelope, is the key. The signed envelope is retained as the
 * artifact a future confirmation step re-offers to the network, exactly as
 * `FundingIntentSubmission` retains it.
 */
export interface RevenueShareDistributionSubmission {
  readonly distributionId: string;
  readonly network: string;
  readonly networkPassphrase: string;
  readonly sourceAccountId: string;
  /** The effective sequence encoded in the envelope. uint64 as a string, never a number. */
  readonly sourceSequence: string;
  /** Omitted means the distribution carries no memo. */
  readonly memo?: string;
  readonly expiresAt: string;
  /** The signed envelope a verified submission persisted. */
  readonly signedXdr: string;
  readonly transactionHash: string;
  /** Traceability link to the application under review, when there is one. */
  readonly applicationId?: string;
  /**
   * One native payment per destination, in the order the envelope encodes them.
   * Each entry is exactly `(accountId, amountStroops)`; a traceability label the
   * envelope cannot carry does not belong here.
   */
  readonly recipients: readonly DistributionRecipient[];
}

/**
 * A persisted distribution as read back. `recipients[].amountStroops` stays a
 * `bigint` end to end; the adapter is responsible for decoding whatever JSON
 * representation the database client returned without ever going through a
 * float.
 */
export interface RevenueShareDistributionRecord extends RevenueShareDistributionSubmission {
  readonly state: RevenueShareDistributionState;
  /** The correlation id of the request that created the row. */
  readonly lastCorrelationId: CorrelationId;
  /**
   * How many poll attempts have been recorded against this distribution. It is
   * server-owned, it only ever grows, and it is what makes "bounded" observable
   * rather than asserted.
   */
  readonly confirmationAttempts: number;
  /**
   * When the next poll attempt becomes due. Never null: a freshly submitted row
   * is due immediately, which is what lets a restart resume a poll it did not
   * start.
   */
  readonly nextAttemptAt: string;
  /**
   * Horizon's own timestamp for the including ledger — the ledger close time,
   * not a local clock reading. Present exactly when `state` is `confirmed`.
   */
  readonly confirmedAt?: string;
  /** The ledger that included the transaction. Present exactly when `confirmed`. */
  readonly ledgerSequence?: string;
  /**
   * A short, sanitised, non-sensitive reason from the closed
   * `stellar-failure-reason` vocabulary. Present exactly when `failed`, and
   * never Horizon's raw response.
   */
  readonly failureReason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The two terminal outcomes Horizon can establish. Modelled as a discriminated
 * union rather than a state plus optional evidence, so "confirmed without a
 * ledger" and "failed without a reason" are unrepresentable here — and, because
 * the database pins the same invariant with a CHECK, unrepresentable in a row.
 */
export type RevenueShareDistributionConfirmation =
  | {
      readonly outcome: "confirmed";
      /** Horizon's ledger close time for the including ledger. */
      readonly confirmedAt: string;
      readonly ledgerSequence: string;
    }
  | { readonly outcome: "failed"; readonly reason: string };

export interface RevenueShareDistributionTransition {
  readonly record: RevenueShareDistributionRecord;
  /**
   * `false` means the conditional update matched no row: the distribution had
   * already reached a terminal state, so this transition was a replay and
   * changed nothing. It is an outcome, not an error — the same distinction
   * `applied` draws on `submit`.
   */
  readonly applied: boolean;
}

export interface RevenueShareDistributionSubmissionOutcome {
  readonly record: RevenueShareDistributionRecord;
  /**
   * `false` means an exact replay: the same `distributionId` **and** the same
   * `transactionHash` were already persisted, so the original row is returned
   * unchanged instead of applying the submission twice.
   */
  readonly applied: boolean;
}

export interface RevenueShareDistributionRepositoryPort {
  /**
   * Persists a verified distribution and its recipient rows, idempotently.
   *
   * Reusing `distributionId` with the same `transactionHash` returns the
   * original record with `applied: false`. Reusing it with a *different* hash is
   * an `idempotency_conflict`, as is reusing the same `transactionHash` under a
   * different `distributionId` — one signed transaction must not distribute
   * twice.
   */
  submit(input: {
    record: RevenueShareDistributionSubmission;
    correlationId: CorrelationId;
  }): Promise<RevenueShareDistributionRepositoryResult<RevenueShareDistributionSubmissionOutcome>>;

  findById(
    distributionId: string
  ): Promise<RevenueShareDistributionRepositoryResult<RevenueShareDistributionRecord>>;

  /**
   * Records a poll attempt that did not reach a terminal state, and schedules
   * the next one.
   *
   * The state deliberately does not move: an attempt that observed nothing
   * conclusive leaves the distribution `submitted`, because Vaqcrow does not
   * know the outcome and must not invent one. Pushing `nextAttemptAt` forward is
   * what makes the following run a resumption instead of a fresh start.
   *
   * Conditional on the row still being `submitted`, so an attempt that raced a
   * confirmation reports `applied: false` instead of resurrecting a terminal
   * distribution.
   */
  recordAttempt(input: {
    distributionId: string;
    /** The new absolute count, not a delta: the caller owns the policy. */
    attempts: number;
    nextAttemptAt: string;
    correlationId: CorrelationId;
  }): Promise<RevenueShareDistributionRepositoryResult<RevenueShareDistributionTransition>>;

  /**
   * Records the terminal outcome Horizon established.
   *
   * Conditional on `state = 'submitted'`, so a replayed confirmation is a
   * non-application rather than a double-apply — the same conditional-update
   * shape the funding-intent repository uses, and the reason this is not an
   * upsert.
   */
  recordConfirmation(input: {
    distributionId: string;
    confirmation: RevenueShareDistributionConfirmation;
    correlationId: CorrelationId;
  }): Promise<RevenueShareDistributionRepositoryResult<RevenueShareDistributionTransition>>;

  /**
   * Reads the distributions still awaiting an outcome whose next attempt is due.
   *
   * This is the resumption surface: because the schedule is a persisted fact
   * rather than an in-process timer, a poll that a restart interrupted is picked
   * up by the next process from the same table. `now` is an argument rather than
   * a call to the clock so the caller's notion of time is the only one in play.
   */
  findPending(input: {
    readonly now: string;
    readonly limit: number;
  }): Promise<RevenueShareDistributionRepositoryResult<readonly RevenueShareDistributionRecord[]>>;
}

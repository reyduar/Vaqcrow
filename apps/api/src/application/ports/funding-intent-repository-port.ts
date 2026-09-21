import type { CorrelationId } from "@vaqcrow/contracts";

/**
 * Persists a submitted funding intent, moves it through confirmation, and reads
 * it back.
 *
 * A funding intent is financial evidence: once a signed transaction exists, the
 * record of what was authorized must survive. #24 modelled only two operations —
 * an idempotent `submit` and a `findById` — because it could produce exactly one
 * state and nothing was ever updated. #25 widens the state machine, and the
 * write surface grows by exactly what a bounded, resumable poll needs: an
 * attempt record that does not move the state, a terminal transition that does,
 * and a read of the rows still awaiting an outcome.
 *
 * What does *not* grow is as important. There is still no delete, and no
 * operation that rewrites the financial facts a verified submission persisted:
 * `amountStroops`, `transactionHash`, `signedXdr` and the terms are immutable
 * after `submit`. A transition may only move `state` and the confirmation
 * evidence that goes with it — enforced at the database by a column-scoped
 * grant, so this is a boundary the API role physically cannot cross.
 *
 * The shapes here are plain data. Nothing in this file imports the Supabase or
 * Stellar SDKs, so `application/` stays provider-free by construction and the
 * adapter owns every encoding decision. Timestamps cross this boundary as ISO
 * strings and amounts as `bigint` stroops, matching `BuiltFundingIntentXdr` and
 * `VerifiedFundingIntentXdr` so a built/verified pair maps onto a submission
 * without a numeric conversion in between.
 */

export type FundingIntentRepositoryErrorCode =
  | "not_found"
  | "idempotency_conflict"
  | "unavailable";

export interface FundingIntentRepositoryError {
  readonly code: FundingIntentRepositoryErrorCode;
}

export type FundingIntentRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FundingIntentRepositoryError };

/**
 * The facts a *verified* submission persists, supplied by the use case.
 *
 * `state`, `createdAt` and `updatedAt` are deliberately absent: they are
 * server-owned facts, set by the adapter and the database, never by a caller.
 * `lastCorrelationId` is likewise absent because it arrives as the separate
 * `correlationId` argument, exactly as `recordHumanDecision` takes its command
 * and its correlation id apart.
 *
 * `network` and `networkPassphrase` are both persisted rather than inferred
 * (`product.md` §7): the passphrase is what a signature commits to, and the
 * network name is what a human reads later. Neither is derivable from the
 * other without a lookup table, so both travel explicitly.
 *
 * `transactionHash` is the payload fingerprint: it already commits to source,
 * sequence, operations, memo, time bounds and network. The signature bytes may
 * legitimately vary over the same hash, so the hash — not the signed XDR — is
 * what idempotency keys on.
 */
export interface FundingIntentSubmission {
  readonly intentId: string;
  readonly network: string;
  readonly networkPassphrase: string;
  readonly sourceAccountId: string;
  /** The effective sequence encoded in the envelope. It is a uint64: string, never a number. */
  readonly sourceSequence: string;
  readonly destinationAccountId: string;
  /** Native (XLM) amount in stroops. Integer-only; 1 XLM = 10,000,000 stroops. */
  readonly amountStroops: bigint;
  /** Omitted means the intent carries no memo. */
  readonly memo?: string;
  readonly expiresAt: string;
  /** The pertinent signed envelope — the one #25 will submit. */
  readonly signedXdr: string;
  readonly transactionHash: string;
  /** Traceability link to the application under review, when there is one. */
  readonly applicationId?: string;
}

/**
 * The funding-intent state machine, as the demo can produce it.
 *
 * `submitted` is where a verified submission lands and where it stays until
 * Horizon says otherwise. `confirmed` and `failed` are terminal, and Horizon is
 * the only thing that can reach either: nothing in this codebase sets them by
 * hand (`DEMO.md` §11). `manual_review` and the pre-submission states in
 * `product.md` §8.1 belong to the production roadmap, not to this set.
 */
export type FundingIntentState = "submitted" | "confirmed" | "failed";

/**
 * A persisted intent as read back. `amountStroops` stays a `bigint` end to end;
 * the adapter is responsible for decoding whatever JSON representation the
 * database client returned without ever going through a float.
 */
export interface FundingIntentRecord extends FundingIntentSubmission {
  readonly state: FundingIntentState;
  /** The correlation id of the request that created the row. */
  readonly lastCorrelationId: CorrelationId;
  /**
   * How many poll attempts have been recorded against this intent. It is
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
   * A short, sanitised, non-sensitive reason. Present exactly when `failed`.
   * It is never Horizon's raw response: a reason crosses this boundary only
   * after the adapter has reduced it to a value the demo can show.
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
export type FundingIntentConfirmation =
  | {
      readonly outcome: "confirmed";
      /** Horizon's ledger close time for the including ledger. */
      readonly confirmedAt: string;
      readonly ledgerSequence: string;
    }
  | { readonly outcome: "failed"; readonly reason: string };

export interface FundingIntentTransition {
  readonly record: FundingIntentRecord;
  /**
   * `false` means the conditional update matched no row: the intent had already
   * reached a terminal state, so this transition was a replay and changed
   * nothing. It is an outcome, not an error — the same distinction `applied`
   * draws on `submit`.
   */
  readonly applied: boolean;
}

export interface FundingIntentSubmissionOutcome {
  readonly record: FundingIntentRecord;
  /**
   * `false` means an exact replay: the same `intentId` **and** the same
   * `transactionHash` were already persisted, so the original row is returned
   * unchanged instead of applying the submission twice.
   */
  readonly applied: boolean;
}

export interface FundingIntentRepositoryPort {
  /**
   * Persists a verified funding intent, idempotently.
   *
   * Reusing `intentId` with the same `transactionHash` returns the original
   * record with `applied: false`. Reusing it with a *different* hash is an
   * `idempotency_conflict`, as is reusing the same `transactionHash` under a
   * different `intentId` — one signed transaction must not fund two intents.
   */
  submit(input: {
    record: FundingIntentSubmission;
    correlationId: CorrelationId;
  }): Promise<FundingIntentRepositoryResult<FundingIntentSubmissionOutcome>>;

  findById(intentId: string): Promise<FundingIntentRepositoryResult<FundingIntentRecord>>;

  /**
   * Records a poll attempt that did not reach a terminal state, and schedules
   * the next one.
   *
   * The state deliberately does not move: an attempt that observed nothing
   * conclusive leaves the intent `submitted`, because Vaqcrow does not know the
   * outcome and must not invent one. Pushing `nextAttemptAt` forward is what
   * makes the following run a resumption instead of a fresh start.
   *
   * Conditional on the row still being `submitted`, so an attempt that raced a
   * confirmation reports `applied: false` instead of resurrecting a terminal
   * intent.
   */
  recordAttempt(input: {
    intentId: string;
    /** The new absolute count, not a delta: the caller owns the policy. */
    attempts: number;
    nextAttemptAt: string;
    correlationId: CorrelationId;
  }): Promise<FundingIntentRepositoryResult<FundingIntentTransition>>;

  /**
   * Records the terminal outcome Horizon established.
   *
   * Conditional on `state = 'submitted'`, so a replayed confirmation is a
   * non-application rather than a double-apply — the same conditional-update
   * shape `recordHumanDecision` uses, and the reason this is not an upsert.
   */
  recordConfirmation(input: {
    intentId: string;
    confirmation: FundingIntentConfirmation;
    correlationId: CorrelationId;
  }): Promise<FundingIntentRepositoryResult<FundingIntentTransition>>;

  /**
   * Reads the intents still awaiting an outcome whose next attempt is due.
   *
   * This is the resumption surface: because the schedule is a persisted fact
   * rather than an in-process timer, a poll that a restart interrupted is picked
   * up by the next process from the same table. `now` is an argument rather than
   * a call to the clock so the caller's notion of time is the only one in play,
   * and a test can drive it.
   */
  findPending(input: {
    readonly now: string;
    readonly limit: number;
  }): Promise<FundingIntentRepositoryResult<readonly FundingIntentRecord[]>>;
}

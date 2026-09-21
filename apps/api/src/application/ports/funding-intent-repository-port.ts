import type { CorrelationId } from "@vaqcrow/contracts";

/**
 * Persists a submitted funding intent and reads it back.
 *
 * A funding intent is financial evidence: once a signed transaction exists, the
 * record of what was authorized must survive. This port therefore models only
 * two operations — an idempotent `submit` and a `findById` — and never an
 * update or a delete. Widening the state machine is #25's job, not a caller's.
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
 * #24 can persist exactly one state (acceptance criterion 3, design D3): the
 * prepare step is stateless (D2), so a row is only ever written by a verified
 * submission. #25 widens this union when asynchronous confirmation lands.
 */
export type FundingIntentState = "submitted";

/**
 * A persisted intent as read back. `amountStroops` stays a `bigint` end to end;
 * the adapter is responsible for decoding whatever JSON representation the
 * database client returned without ever going through a float.
 */
export interface FundingIntentRecord extends FundingIntentSubmission {
  readonly state: FundingIntentState;
  /** The correlation id of the request that created the row. */
  readonly lastCorrelationId: CorrelationId;
  readonly createdAt: string;
  readonly updatedAt: string;
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
}

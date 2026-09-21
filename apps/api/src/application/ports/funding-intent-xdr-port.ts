/**
 * Builds and verifies the XDR a funding intent is signed as.
 *
 * This port exists because `api-application-stays-provider-free` forbids the
 * Stellar SDK under `application/`: the use case decides *what* a funding
 * intent is, while the adapter owns *how* it is encoded and verified. Nothing
 * here imports the SDK — every shape is plain data, so the port stays portable
 * and the boundary is enforced by construction.
 *
 * Money never crosses this boundary as a float. Amounts are stroops (`bigint`),
 * matching `LedgerPort`; 1 XLM = 10,000,000 stroops.
 *
 * The network passphrase is always an explicit parameter. It is never defaulted
 * and never read from the environment here, so the caller is the single owner
 * of which network an intent belongs to.
 */

/**
 * A coarse failure kind for the caller, plus an optional `reason` naming the
 * field that caused it for logs and tests.
 *
 * The set is deliberately small:
 * - `invalid_input` — the caller handed the port something it cannot use
 *   (an unbuildable intent, or an `expiresAt` that is not a timestamp).
 * - `malformed_xdr` — the envelope cannot be decoded at all.
 * - `fee_bump` — the envelope is a fee-bump wrapper (refused by design, so the
 *   outer-fee indirection cannot smuggle a different inner transaction).
 * - `unsupported_operation` — the operation set is not exactly one payment.
 * - `intent_mismatch` — a field does not equal the intent the caller expected.
 * - `expired` — the time bounds are no longer valid against the current time.
 * - `invalid_signature` — no signature from the expected source account passes
 *   cryptographic verification.
 *
 * Sanitization for HTTP callers belongs to the route layer; this port returns
 * the reason it found so a later boundary can decide what to expose.
 */
export type FundingIntentXdrErrorCode =
  | "invalid_input"
  | "malformed_xdr"
  | "fee_bump"
  | "unsupported_operation"
  | "intent_mismatch"
  | "expired"
  | "invalid_signature";

export interface FundingIntentXdrError {
  readonly code: FundingIntentXdrErrorCode;
  /** The field at fault (`destination`, `timebounds`, `signature`, …). */
  readonly reason?: string;
}

export type FundingIntentXdrResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FundingIntentXdrError };

export interface BuildFundingIntentXdrInput {
  readonly networkPassphrase: string;
  readonly sourceAccountId: string;
  /** The source account sequence, as a string: it is a uint64. */
  readonly sourceSequence: string;
  readonly destinationAccountId: string;
  readonly amountStroops: bigint;
  /** A text memo. Omitted means no memo. */
  readonly memo?: string;
  /**
   * Absolute unix-seconds upper time bound. Omitted falls back to a short
   * adapter default, because a funding intent must never be valid forever.
   */
  readonly maxTimeUnixSeconds?: number;
}

export interface BuiltFundingIntentXdr {
  /** The unsigned envelope, ready for the account owner to sign. */
  readonly xdr: string;
  readonly networkPassphrase: string;
  readonly sourceAccountId: string;
  /**
   * The *effective* sequence encoded in the envelope — the account sequence the
   * caller supplied, incremented once by the builder. Persist this value: it is
   * exactly what `verify` compares the signed envelope against.
   */
  readonly sourceSequence: string;
  readonly destinationAccountId: string;
  readonly amountStroops: bigint;
  readonly memo?: string;
  /** ISO timestamp derived from the time bounds that were set. */
  readonly expiresAt: string;
}

export interface VerifyFundingIntentXdrInput {
  /** The signed envelope under review. */
  readonly xdr: string;
  readonly networkPassphrase: string;
  readonly sourceAccountId: string;
  readonly sourceSequence: string;
  readonly destinationAccountId: string;
  readonly amountStroops: bigint;
  readonly memo?: string;
  /** The expiry the intent was persisted with. */
  readonly expiresAt: string;
}

export interface VerifiedFundingIntentXdr {
  /** Hex of the transaction hash, which is what the network will submit. */
  readonly transactionHash: string;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly amountStroops: bigint;
  readonly memo?: string;
  readonly expiresAt: string;
}

export interface FundingIntentXdrPort {
  /**
   * Encodes an intent as an unsigned payment transaction.
   *
   * An unbuildable intent resolves `invalid_input` instead of throwing, so the
   * caller never has to defend against an exception from the encoding layer.
   */
  build(input: BuildFundingIntentXdrInput): FundingIntentXdrResult<BuiltFundingIntentXdr>;

  /**
   * Re-validates a signed envelope against the intent it was built from.
   *
   * The envelope must be exactly one native payment, from the expected source
   * and sequence, to the expected destination and amount, with the expected
   * memo, within the expected and still-valid time bounds, and carrying a
   * signature that verifies against the expected source public key. Any
   * deviation resolves a typed failure; the method never throws.
   *
   * The asset is checked against the native asset rather than taken as an
   * expected parameter. The demo settles XLM only (`#24` scope), so there is no
   * other asset an intent could legitimately name; passing one in would only
   * invite a second source of truth for a value that cannot vary.
   */
  verify(input: VerifyFundingIntentXdrInput): FundingIntentXdrResult<VerifiedFundingIntentXdr>;
}

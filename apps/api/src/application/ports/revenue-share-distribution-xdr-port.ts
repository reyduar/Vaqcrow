import type { DistributionRecipient, RevenueShareDistributionTerms } from "@vaqcrow/contracts";

/**
 * Builds and verifies the XDR a revenue-share distribution is signed as.
 *
 * This port exists because `api-application-stays-provider-free` forbids the
 * Stellar SDK under `application/`: the use case decides *what* a distribution
 * is, while the adapter owns *how* it is encoded and verified. Nothing here
 * imports the SDK — every shape is plain data, so the port stays portable and
 * the boundary is enforced by construction. It does name the S1 wire contract's
 * `RevenueShareDistributionTerms`, so the adapter binds a signed envelope to
 * exactly the terms the caller declared and nothing else.
 *
 * Money never crosses this boundary as a float. Amounts are stroops (`bigint`),
 * matching `LedgerPort` and `FundingIntentXdrPort`; 1 XLM = 10,000,000 stroops.
 *
 * The network passphrase is always taken from the declared terms and is never
 * defaulted or read from the environment. `terms.network` is the human label the
 * API carries for its callers; the adapter binds only the passphrase, because
 * the passphrase — not the label — is what a signature commits to.
 */

/**
 * A coarse failure kind for the caller, plus an optional `reason` naming the
 * field that caused it for logs and tests.
 *
 * The set is deliberately the same vocabulary the single-payment
 * `FundingIntentXdrPort` uses, so a caller handles one closed set across both
 * flows:
 * - `invalid_input` — the caller handed the port something it cannot use (an
 *   unbuildable distribution, or an `expiresAt`/`maxTimeUnixSeconds` that is not
 *   a usable timestamp).
 * - `malformed_xdr` — the envelope cannot be decoded at all.
 * - `fee_bump` — the envelope is a fee-bump wrapper (refused by design, so the
 *   outer-fee indirection cannot smuggle a different inner transaction).
 * - `unsupported_operation` — the operation set is not exactly one payment per
 *   declared recipient, or one of them is not a payment.
 * - `intent_mismatch` — a field does not equal the terms the caller declared.
 * - `expired` — the time bounds are no longer valid against the current time.
 * - `invalid_signature` — no signature from the expected source account passes
 *   cryptographic verification.
 *
 * Sanitization for HTTP callers belongs to the route layer; this port returns
 * the reason it found so a later boundary can decide what to expose.
 */
export type RevenueShareDistributionXdrErrorCode =
  | "invalid_input"
  | "malformed_xdr"
  | "fee_bump"
  | "unsupported_operation"
  | "intent_mismatch"
  | "expired"
  | "invalid_signature";

export interface RevenueShareDistributionXdrError {
  readonly code: RevenueShareDistributionXdrErrorCode;
  /** The field at fault (`recipients`, `timebounds`, `signature`, …). */
  readonly reason?: string;
}

export type RevenueShareDistributionXdrResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RevenueShareDistributionXdrError };

export interface BuildRevenueShareDistributionXdrInput {
  /**
   * The terms the distribution commits to: the passphrase, source and sequence,
   * memo, expiry and the ordered recipient list. The declared `network` label
   * travels with them for the caller but is not a fact the adapter verifies.
   */
  readonly terms: RevenueShareDistributionTerms;
  /**
   * Absolute unix-seconds upper time bound. Omitted falls back to the declared
   * `terms.expiresAt`, so the envelope the caller signs matches the expiry they
   * declared; a distribution must never be valid forever.
   */
  readonly maxTimeUnixSeconds?: number;
}

export interface BuiltRevenueShareDistributionXdr {
  /** The unsigned envelope, ready for the account owner to sign. */
  readonly xdr: string;
  readonly networkPassphrase: string;
  readonly sourceAccountId: string;
  /**
   * The *effective* sequence encoded in the envelope — the account sequence the
   * terms supplied, incremented once by the builder. Persist this value: it is
   * exactly what `verify` compares the signed envelope against.
   */
  readonly sourceSequence: string;
  /** The declared recipients, in their declared order. */
  readonly recipients: readonly DistributionRecipient[];
  /** The declared memo; `null` is the declared absence of one. */
  readonly memo: string | null;
  /** ISO timestamp derived from the time bounds that were set. */
  readonly expiresAt: string;
}

export interface VerifyRevenueShareDistributionXdrInput {
  /** The signed envelope under review. */
  readonly xdr: string;
  /** The terms the signed envelope is expected to commit to. */
  readonly terms: RevenueShareDistributionTerms;
}

export interface VerifiedRevenueShareDistributionXdr {
  /** Hex of the transaction hash, which is what the network will submit. */
  readonly transactionHash: string;
  readonly sourceAccountId: string;
  /**
   * The recipients recovered from the envelope's operations, in envelope order:
   * each `(accountId, amountStroops)` is read back from the payment it encoded,
   * never echoed from the caller's request.
   */
  readonly recipients: readonly DistributionRecipient[];
  /** The memo decoded from the envelope; `null` when the envelope carries none. */
  readonly memo: string | null;
  /** ISO expiry derived from the envelope's own upper time bound. */
  readonly expiresAt: string;
}

export interface RevenueShareDistributionXdrPort {
  /**
   * Encodes a distribution as an unsigned classic transaction with exactly one
   * native payment per declared recipient, in the declared order.
   *
   * An unbuildable distribution resolves `invalid_input` instead of throwing, so
   * the caller never has to defend against an exception from the encoding layer.
   */
  build(
    input: BuildRevenueShareDistributionXdrInput
  ): RevenueShareDistributionXdrResult<BuiltRevenueShareDistributionXdr>;

  /**
   * Re-validates a signed envelope against the terms it was built from.
   *
   * The envelope must be exactly one native payment per declared recipient, in
   * the declared order, from the expected source and sequence, with the expected
   * memo, within the expected and still-valid time bounds, and carrying a
   * signature that verifies against the expected source public key. Any
   * deviation resolves a typed failure; the method never throws.
   *
   * The asset is checked against the native asset rather than taken as an
   * expected parameter: the demo settles XLM only (`#28` scope), so there is no
   * other asset a distribution could legitimately name.
   */
  verify(
    input: VerifyRevenueShareDistributionXdrInput
  ): RevenueShareDistributionXdrResult<VerifiedRevenueShareDistributionXdr>;
}

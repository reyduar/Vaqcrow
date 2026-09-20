/**
 * A public Stellar account as Vaqcrow sees it.
 *
 * Deliberately narrow: building a transaction needs an identity and a sequence
 * number, and nothing in this shape is — or can become — key material. Vaqcrow
 * never holds a signing key for a person's account, so the ledger boundary has
 * no way to represent one.
 */
export interface LedgerAccount {
  readonly accountId: string;
  /**
   * The account sequence number, as a string. It is a uint64 and does not fit
   * in a JavaScript number.
   */
  readonly sequence: string;
  /**
   * Native (XLM) balance in stroops. Integer only — money never becomes a
   * float. 1 XLM = 10,000,000 stroops.
   */
  readonly nativeBalanceStroops: bigint;
}

export type LedgerErrorCode = "not_found" | "unavailable";

export interface LedgerError {
  readonly code: LedgerErrorCode;
}

export type LedgerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: LedgerError };

export interface LedgerPort {
  /**
   * Retrieves a public account from the ledger.
   *
   * An address that is well formed but has never been funded resolves
   * `not_found`. On Testnet that is an expected state to show, not a failure to
   * retry, so it is modelled as an outcome rather than thrown.
   */
  getAccount(accountId: string): Promise<LedgerResult<LedgerAccount>>;
}

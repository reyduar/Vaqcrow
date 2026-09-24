/**
 * Classic-account existence and creation, on the platform's own authority.
 *
 * The campaign vault has an off-chain precondition
 * (`contracts/campaign-vault/src/lib.rs`, "off-chain precondition" doc): the
 * SME's account must exist *before* the vault opens, because a payout to a
 * non-existent account would fail atomically with whichever contribution
 * crosses the goal — reverting a transaction that already carries other
 * investors' money. `docs/planning/stellar-blockchain-requirements.md`
 * ("Provisión de la cuenta de la PyME") resolves that by having the platform
 * fund the SME's own public key with `CreateAccount` when the campaign opens
 * (D2 in `odd/tasks/campaign-vault-web-journey.md`), never by holding or
 * generating a key on the SME's behalf.
 *
 * Nothing here imports the Stellar SDK — `api-application-stays-provider-free`
 * forbids it under `application/`. The adapter (`infrastructure/`) owns *how*
 * an account is read or funded; this port only names *what* the use case
 * needs. Signing is not named here either: `createAccount` is authorized by
 * the platform's own key, which only `PlatformSigner` (D8) ever touches, and
 * that stays entirely inside the adapter.
 */

export type StellarAccountErrorCode = "unavailable";

export interface StellarAccountError {
  readonly code: StellarAccountErrorCode;
}

export type StellarAccountResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: StellarAccountError };

export interface CreateAccountInput {
  readonly destination: string;
  /**
   * The initial balance the platform funds the destination with, in stroops —
   * this codebase's one unit for money (see `stellar-amounts.ts`), even
   * though the classic `CreateAccount` operation itself is denominated in
   * XLM on the wire.
   */
  readonly startingBalanceStroops: bigint;
}

export interface CreateAccountOutcome {
  readonly hash: string;
}

export interface StellarAccountPort {
  /**
   * `true`/`false` is a fact about the ledger, never an error: an account
   * that has not been created yet is the expected state of every SME's key
   * before the campaign opens, not a transport failure.
   */
  accountExists(accountId: string): Promise<StellarAccountResult<boolean>>;

  /**
   * `CreateAccount` needs no signature from `destination` — the funding
   * account is the only signer — so this never asks the SME to do anything.
   * Signed by the platform's own key (D8); the caller only ever sees the
   * settled outcome or `unavailable`.
   */
  createAccount(input: CreateAccountInput): Promise<StellarAccountResult<CreateAccountOutcome>>;
}

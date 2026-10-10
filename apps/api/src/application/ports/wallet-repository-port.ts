/**
 * The PyME Freighter wallet boundary (Feature #406, Task #407 / T1b).
 *
 * A PyME proves ownership of a Stellar account by signing a single-use nonce
 * challenge with Freighter; the API then stores the resulting `G...` public key
 * on `public.profile.stellar_public_key`. That key becomes the vault's immutable
 * destination when an admin approves the campaign, so it is replaceable exactly
 * until a vault exists and frozen afterwards (`isFrozen`).
 *
 * Both `public.profile` and `public.wallet_challenge` are `service_role`-only,
 * so every read/write here is scoped by the authenticated owner the caller
 * resolved from the verified token. Plain data only: this port lives in
 * `application/` and imports no Fastify, Supabase or Stellar SDK.
 */

export interface WalletChallengeRecord {
  readonly challengeId: string;
  readonly ownerUserId: string;
  readonly nonce: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
}

export type WalletRepositoryErrorCode = "not_found" | "invalid_request" | "unavailable";

export interface WalletRepositoryError {
  readonly code: WalletRepositoryErrorCode;
}

export type WalletRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: WalletRepositoryError };

export interface WalletRepositoryPort {
  /** Records a fresh single-use challenge for the owner. `consumedAt` is null. */
  createChallenge(input: {
    readonly challengeId: string;
    readonly ownerUserId: string;
    readonly nonce: string;
    readonly expiresAt: string;
  }): Promise<WalletRepositoryResult<WalletChallengeRecord>>;

  /**
   * Loads a challenge by id **and** owner, so a challenge issued to another
   * principal is `not_found` rather than usable.
   */
  findChallenge(input: {
    readonly challengeId: string;
    readonly ownerUserId: string;
  }): Promise<WalletRepositoryResult<WalletChallengeRecord>>;

  /**
   * Marks the challenge consumed with a conditional update
   * (`consumed_at is null`), so a replay cannot consume it twice. `not_found`
   * means it was already consumed.
   */
  consumeChallenge(challengeId: string): Promise<WalletRepositoryResult<void>>;

  /** The owner's stored key, or `null` when none has been connected yet. */
  readPublicKey(ownerUserId: string): Promise<WalletRepositoryResult<string | null>>;

  /** Stores the verified key on the owner's profile row. */
  writePublicKey(input: {
    readonly ownerUserId: string;
    readonly publicKey: string;
  }): Promise<WalletRepositoryResult<void>>;

  /**
   * Whether one of the owner's applications already has a deployed campaign
   * (vault). A frozen key is the vault's immutable destination and cannot be
   * replaced.
   */
  isFrozen(ownerUserId: string): Promise<WalletRepositoryResult<boolean>>;
}

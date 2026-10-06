/**
 * Persisted Freighter wallet capability of the PyME profile (Feature #406,
 * Task #407 / T1c). Vendor-free and React-free: the HTTP adapter lives in
 * `infrastructure/wallet/`.
 *
 * A connection is proven, not asserted: the API issues a single-use challenge,
 * the client signs its message with Freighter (`signMessage`, SEP-53) and
 * submits the signature; only then does the API store the public key as the
 * vault's immutable destination. The owner is resolved by the API from the
 * verified session token, so no method here ever sends an owner.
 *
 * Every failure is a sanitized code in the API's own vocabulary plus the
 * transport's `network`; provider messages never cross this boundary.
 */

/** The stored connection, as `POST /profile/wallet` returns it. */
export interface WalletConnection {
  readonly publicKey: string;
  /** `true` once a vault exists for the owner: the destination can no longer change. */
  readonly frozen: boolean;
}

/** The single-use challenge the API issued; `message` is exactly what is signed. */
export interface WalletChallenge {
  readonly challengeId: string;
  readonly message: string;
}

/**
 * Sanitized failure codes. They mirror the API's `{ code }` envelopes plus the
 * transport's own `network`; the UI maps each one to copy.
 */
export type WalletConnectionErrorCode =
  | "invalid_request"
  | "not_found"
  | "wallet_frozen"
  | "unauthorized"
  | "unavailable"
  | "network";

export const WALLET_CONNECTION_ERROR_CODES: readonly WalletConnectionErrorCode[] = Object.freeze([
  "invalid_request",
  "not_found",
  "wallet_frozen",
  "unauthorized",
  "unavailable",
  "network"
]);

export type WalletChallengeResult =
  | { readonly ok: true; readonly challenge: WalletChallenge }
  | { readonly ok: false; readonly code: WalletConnectionErrorCode };

export type WalletConnectionResult =
  | { readonly ok: true; readonly connection: WalletConnection }
  | { readonly ok: false; readonly code: WalletConnectionErrorCode };

/**
 * The stored state, as `GET /profile/wallet` returns it: `publicKey` is `null`
 * when the owner has never linked an account, which is a normal success, not an
 * error.
 */
export type WalletStateResult =
  | { readonly ok: true; readonly publicKey: string | null; readonly frozen: boolean }
  | { readonly ok: false; readonly code: WalletConnectionErrorCode };

export interface WalletConnectionInput {
  readonly challengeId: string;
  readonly publicKey: string;
  readonly signature: string;
}

export interface WalletConnectionPort {
  /** Issues a fresh single-use challenge for the signed-in principal. */
  requestChallenge(): Promise<WalletChallengeResult>;
  /** Submits the challenge signature; the API verifies it before storing the key. */
  submitConnection(input: WalletConnectionInput): Promise<WalletConnectionResult>;
  /** Reads the signed-in principal's own connection; no owner is ever a parameter. */
  getConnection(): Promise<WalletStateResult>;
}

import type { WalletRepositoryPort } from "../ports/wallet-repository-port.js";
import type { WalletSignaturePort } from "../ports/wallet-signature-port.js";

/**
 * The PyME Freighter wallet use cases (Feature #406, Task #407 / T1b).
 *
 * A connection is proven, not asserted: the API issues a single-use challenge,
 * the client signs its message with Freighter (`signMessage`, SEP-53), and the
 * API verifies the signature before storing the public key. The key is the
 * vault's immutable destination once a campaign is deployed, so it can be
 * replaced only while the owner is not frozen.
 *
 * Every failure is a sanitized code; no repository or provider text crosses
 * this boundary. Signature verification itself lives behind
 * `WalletSignaturePort`, implemented in `infrastructure/` with the SDK.
 */

/** How long an unconsumed challenge stays valid. */
export const WALLET_CHALLENGE_TTL_SECONDS = 300;

/** The DB constraint's shape: `G` + 55 base32 characters. */
const PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONNECT_BODY_KEYS: ReadonlySet<string> = new Set(["challengeId", "publicKey", "signature"]);

/**
 * The exact string the client signs. It is stable and self-describing so a
 * wallet prompt is unambiguous; the nonce lives inside it so a captured
 * signature can never be replayed against a different challenge. SEP-53's own
 * `"Stellar Signed Message:\n"` prefix is added by the signer and verifier, not
 * here.
 */
export function buildWalletChallengeMessage(nonce: string): string {
  return [
    "Vaqcrow wallet connection challenge",
    "",
    "Sign this message to link your Stellar account (Freighter) to your Vaqcrow PyME profile.",
    "This signature proves you control the account and authorizes no payment or transaction.",
    "",
    `Nonce: ${nonce}`
  ].join("\n");
}

export type WalletErrorCode = "invalid_request" | "not_found" | "frozen" | "unavailable";

export interface WalletError {
  readonly code: WalletErrorCode;
}

export type WalletResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: WalletError };

const INVALID: WalletResult<never> = { ok: false, error: { code: "invalid_request" } };
const UNAVAILABLE: WalletResult<never> = { ok: false, error: { code: "unavailable" } };

export interface WalletChallenge {
  readonly challengeId: string;
  readonly message: string;
}

export interface IssueWalletChallengeDependencies {
  readonly repository: Pick<WalletRepositoryPort, "createChallenge">;
  /** Injected for deterministic tests; `index.ts` passes `crypto.randomUUID`. */
  readonly generateChallengeId: () => string;
  readonly generateNonce: () => string;
  readonly ttlSeconds: number;
  readonly now?: () => Date;
}

export async function issueWalletChallenge(
  dependencies: IssueWalletChallengeDependencies,
  input: { readonly ownerUserId: string }
): Promise<WalletResult<WalletChallenge>> {
  const now = dependencies.now?.() ?? new Date();
  const challengeId = dependencies.generateChallengeId();
  const nonce = dependencies.generateNonce();
  const expiresAt = new Date(now.getTime() + dependencies.ttlSeconds * 1000).toISOString();

  const created = await dependencies.repository.createChallenge({
    challengeId,
    ownerUserId: input.ownerUserId,
    nonce,
    expiresAt
  });

  if (!created.ok) {
    return created.error.code === "invalid_request" ? INVALID : UNAVAILABLE;
  }

  return { ok: true, value: { challengeId, message: buildWalletChallengeMessage(nonce) } };
}

export interface WalletConnection {
  readonly publicKey: string;
  readonly frozen: boolean;
}

export interface ConnectWalletDependencies {
  readonly repository: Pick<
    WalletRepositoryPort,
    "findChallenge" | "consumeChallenge" | "writePublicKey" | "isFrozen"
  >;
  readonly signatures: Pick<WalletSignaturePort, "verifyMessage">;
  readonly now?: () => Date;
}

export async function connectWallet(
  dependencies: ConnectWalletDependencies,
  input: { readonly ownerUserId: string; readonly body: unknown }
): Promise<WalletResult<WalletConnection>> {
  const body = input.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return INVALID;
  }

  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => !CONNECT_BODY_KEYS.has(key))) {
    return INVALID;
  }

  const challengeId = record["challengeId"];
  const publicKey = record["publicKey"];
  const signature = record["signature"];

  if (typeof challengeId !== "string" || !UUID_PATTERN.test(challengeId)) {
    return INVALID;
  }
  if (typeof publicKey !== "string" || !PUBLIC_KEY_PATTERN.test(publicKey)) {
    return INVALID;
  }
  if (typeof signature !== "string" || signature.length === 0) {
    return INVALID;
  }

  const found = await dependencies.repository.findChallenge({
    challengeId,
    ownerUserId: input.ownerUserId
  });

  if (!found.ok) {
    return found.error.code === "not_found"
      ? { ok: false, error: { code: "not_found" } }
      : UNAVAILABLE;
  }

  const challenge = found.value;
  const now = dependencies.now?.() ?? new Date();
  const expiresAtMs = Date.parse(challenge.expiresAt);

  if (challenge.consumedAt !== null || !Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime()) {
    return INVALID;
  }

  const valid = dependencies.signatures.verifyMessage({
    publicKey,
    message: buildWalletChallengeMessage(challenge.nonce),
    signature
  });

  if (!valid) {
    return INVALID;
  }

  const frozen = await dependencies.repository.isFrozen(input.ownerUserId);
  if (!frozen.ok) {
    return UNAVAILABLE;
  }
  if (frozen.value) {
    return { ok: false, error: { code: "frozen" } };
  }

  // Burn the single-use challenge before storing the key. If the write later
  // fails the challenge is already consumed (fail-closed): the caller must
  // request a fresh challenge, and the stale signature can never be replayed.
  const consumed = await dependencies.repository.consumeChallenge(challengeId);
  if (!consumed.ok) {
    return consumed.error.code === "not_found" ? INVALID : UNAVAILABLE;
  }

  const written = await dependencies.repository.writePublicKey({
    ownerUserId: input.ownerUserId,
    publicKey
  });

  if (!written.ok) {
    return written.error.code === "invalid_request" ? INVALID : UNAVAILABLE;
  }

  return { ok: true, value: { publicKey, frozen: false } };
}

export interface WalletState {
  readonly publicKey: string | null;
  readonly frozen: boolean;
}

export interface GetWalletDependencies {
  readonly repository: Pick<WalletRepositoryPort, "readPublicKey" | "isFrozen">;
}

export async function getWallet(
  dependencies: GetWalletDependencies,
  input: { readonly ownerUserId: string }
): Promise<WalletResult<WalletState>> {
  const stored = await dependencies.repository.readPublicKey(input.ownerUserId);

  let publicKey: string | null;
  if (stored.ok) {
    publicKey = stored.value;
  } else if (stored.error.code === "not_found") {
    // The auth layer guarantees a profile; a missing row is treated as "no key".
    publicKey = null;
  } else {
    return UNAVAILABLE;
  }

  const frozen = await dependencies.repository.isFrozen(input.ownerUserId);
  if (!frozen.ok) {
    return UNAVAILABLE;
  }

  return { ok: true, value: { publicKey, frozen: frozen.value } };
}

import { WalletError, type WalletFailureKind, type WalletPort } from "@/application/ports/wallet-port";
import type {
  WalletConnection,
  WalletConnectionErrorCode,
  WalletConnectionPort
} from "@/application/ports/wallet-connection-port";

/**
 * Pure orchestration of the PyME wallet connection (Feature #406, Task #407 /
 * T1c). React-free so the connect → challenge → sign → store sequence and its
 * sanitized failure mapping are unit-tested without rendering or a browser.
 *
 * A connection is proven, not asserted, and persisted, not just remembered: the
 * public key is only usable once the API has verified the signed challenge and
 * stored it, so the wizard's send gate keys on the stored connection rather
 * than a component-local string.
 */

/**
 * Every way the connection can fail: the wallet's own kinds (`freighter-wallet`
 * sanitizes them) plus the persistence port's codes. The `stage` distinguishes
 * a failure of the wallet (`wallet`/`signature`) from a failure of the API
 * (`challenge`/`store`), which the codes alone cannot — `unavailable` exists on
 * both sides and means different things to the person. Nothing here carries a
 * provider message.
 */
export type WalletConnectFailure =
  | { readonly ok: false; readonly stage: "wallet"; readonly code: WalletFailureKind }
  | { readonly ok: false; readonly stage: "signature"; readonly code: WalletFailureKind }
  | { readonly ok: false; readonly stage: "challenge"; readonly code: WalletConnectionErrorCode }
  | { readonly ok: false; readonly stage: "store"; readonly code: WalletConnectionErrorCode };

export type WalletConnectOutcome = { readonly ok: true; readonly connection: WalletConnection } | WalletConnectFailure;

/**
 * Connects Freighter, requests the API challenge, signs its message and stores
 * the key. The first failure stops the sequence, so a challenge is never signed
 * against a wallet that refused to connect and a key is never stored without a
 * verified signature.
 */
export async function connectAndStoreWallet(
  wallet: WalletPort,
  connection: WalletConnectionPort
): Promise<WalletConnectOutcome> {
  let publicKey: string;
  try {
    const account = await wallet.connect();
    publicKey = account.publicKey;
  } catch (error) {
    return { ok: false, stage: "wallet", code: walletFailureKind(error) };
  }

  const challenge = await connection.requestChallenge();
  if (!challenge.ok) {
    return { ok: false, stage: "challenge", code: challenge.code };
  }

  let signature: string;
  try {
    signature = await wallet.signMessage(challenge.challenge.message);
  } catch (error) {
    return { ok: false, stage: "signature", code: walletFailureKind(error) };
  }

  const stored = await connection.submitConnection({
    challengeId: challenge.challenge.challengeId,
    publicKey,
    signature
  });

  return stored.ok ? { ok: true, connection: stored.connection } : { ok: false, stage: "store", code: stored.code };
}

function walletFailureKind(error: unknown): WalletFailureKind {
  return error instanceof WalletError ? error.kind : "unknown";
}

/**
 * Honest copy for each case the owner named (`#406` decision 1): no wallet
 * installed gets a hint to create one, a refusal preserves the intent, a wallet
 * on another network asks for Testnet, and a frozen account explains why the
 * destination no longer changes. The unfunded case is not a failure: a zero
 * balance is shown in the card and never blocks storing the key.
 */
export const WALLET_KIND_COPY: Readonly<Record<WalletFailureKind, string>> = Object.freeze({
  unavailable: "No encontramos Freighter en este navegador. Instalá la extensión y creá una wallet para continuar.",
  rejected: "Cancelaste la conexión en Freighter. Podés intentarlo de nuevo.",
  network_mismatch: "Freighter está en otra red. Cambiá a Stellar Testnet para continuar.",
  unknown: "No pudimos conectar Freighter. Probá de nuevo."
});

export const WALLET_CONNECTION_COPY: Readonly<Record<WalletConnectionErrorCode, string>> = Object.freeze({
  invalid_request: "No pudimos verificar tu wallet. Probá de nuevo.",
  not_found: "La verificación expiró. Volvé a intentar la conexión.",
  wallet_frozen: "Tu cuenta ya quedó congelada: la bóveda está abierta y el destino no se puede cambiar.",
  unavailable: "No pudimos guardar tu wallet. Revisá tu conexión y probá de nuevo.",
  network: "No pudimos guardar tu wallet. Revisá tu conexión y probá de nuevo."
});

export function walletConnectFailureCopy(failure: WalletConnectFailure): string {
  return failure.stage === "challenge" || failure.stage === "store"
    ? WALLET_CONNECTION_COPY[failure.code]
    : WALLET_KIND_COPY[failure.code];
}

/**
 * Stellar Expert's Testnet account page. The API does not return an explorer
 * link for the wallet (only for transactions/contracts), and a public account
 * address is enough to build this one deterministically; kept here so the card
 * never assembles a URL.
 */
export function walletAccountExplorerUrl(publicKey: string): string {
  return `https://stellar.expert/explorer/testnet/account/${publicKey}`;
}

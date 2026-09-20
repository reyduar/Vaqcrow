export interface WalletAccount {
  readonly publicKey: string;
}

/**
 * Why a wallet call failed.
 *
 * `rejected` (the person declined in the wallet), `unavailable` (there is no
 * wallet to talk to) and `network_mismatch` (the wallet is on another network)
 * are recoverable: the caller can report them and let the person retry without
 * discarding the transaction being prepared. Only `unknown` is not reliably
 * recoverable, because nothing tells the caller what to change.
 */
export type WalletFailureKind = "rejected" | "unavailable" | "network_mismatch" | "unknown";

/**
 * Sanitized failure of a `WalletPort` call. It carries a coarse kind instead of
 * the wallet's own error text, so no vendor message reaches the presentation
 * layer. Lives with the port so `application/` can catch it without importing
 * infrastructure.
 */
export class WalletError extends Error {
  readonly kind: WalletFailureKind;

  constructor(kind: WalletFailureKind, message: string) {
    super(message);
    this.name = "WalletError";
    this.kind = kind;
  }

  /** Whether the caller can offer a retry that has a chance of succeeding. */
  get recoverable(): boolean {
    return this.kind !== "unknown";
  }

  toJSON(): { name: string; kind: WalletFailureKind } {
    return { name: this.name, kind: this.kind };
  }
}

export interface WalletPort {
  isAvailable(): Promise<boolean>;
  connect(): Promise<WalletAccount>;
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
}

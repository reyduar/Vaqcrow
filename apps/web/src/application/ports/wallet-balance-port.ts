/**
 * XLM balance of a connected Testnet account (Feature #406, Task #407 / T1c).
 * Vendor-free and React-free: the adapter lives in `infrastructure/wallet/`.
 *
 * The wallet card shows a balance, but the balance must never make the demo
 * depend on a live Horizon endpoint during pull-request verification. The read
 * therefore sits behind this port: production reads Testnet Horizon over plain
 * HTTP (`HorizonWalletBalanceAdapter`, Feature #557 — the boundary rule
 * `web-never-imports-server-stellar-sdk` keeps the SDK out of the browser
 * bundle) and tests inject a double.
 */

/** Sanitized failure codes; the UI maps each to copy. */
export type WalletBalanceErrorCode = "unavailable" | "network";

export type WalletBalanceResult =
  | { readonly ok: true; readonly balanceXlm: string }
  | { readonly ok: false; readonly code: WalletBalanceErrorCode };

export interface WalletBalancePort {
  /** The account's native XLM balance, already formatted for display. */
  getBalance(publicKey: string): Promise<WalletBalanceResult>;
}

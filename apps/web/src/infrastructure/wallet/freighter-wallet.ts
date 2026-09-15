import type { WalletAccount, WalletPort } from "@/application/ports/wallet-port";

/**
 * Stub adapter for the Freighter browser extension wallet.
 *
 * `@stellar/freighter-api` (verified against its published v6.0.1 README and type
 * declarations) is intentionally NOT installed yet — see design decision D3. Its real
 * exports are `isConnected`, `requestAccess`, `getAddress`, and `signTransaction`
 * (the older `getPublicKey` is superseded). `WalletPort` stays a vendor-neutral
 * abstraction rather than mirroring those names 1:1; the rough mapping this adapter
 * will eventually implement is: `isAvailable` -> `isConnected`, `connect` ->
 * `requestAccess` + `getAddress`, `signTransaction` -> `signTransaction`.
 *
 * Every method below throws until the real SDK is wired in.
 */
export class FreighterWallet implements WalletPort {
  async isAvailable(): Promise<boolean> {
    throw new Error("not implemented");
  }

  async connect(): Promise<WalletAccount> {
    throw new Error("not implemented");
  }

  async signTransaction(_xdr: string, _networkPassphrase: string): Promise<string> {
    throw new Error("not implemented");
  }
}

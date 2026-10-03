/**
 * Test-only in-memory `WalletPort`. No network, no browser extension.
 *
 * `connect` fails when no account is seeded (the "no wallet / rejected" path)
 * or when `failNextConnect` was called, and can be held so the connecting state
 * is observable. `signTransaction` is not exercised by the onboarding wizard
 * and simply returns the input XDR.
 *
 * Not collected as a test suite: it has no `.test.` segment.
 */
import { WalletError, type WalletAccount, type WalletFailureKind, type WalletPort } from "@/application/ports/wallet-port";

export class FakeWallet implements WalletPort {
  private account: WalletAccount | null;
  private failure: WalletFailureKind | null = null;
  private held: Promise<void> | null = null;

  constructor(account: WalletAccount | null = null) {
    this.account = account;
  }

  seedAccount(publicKey: string): void {
    this.account = { publicKey };
  }

  /** The next `connect` rejects with a `WalletError` of `kind`. */
  failNextConnect(kind: WalletFailureKind = "rejected"): void {
    this.failure = kind;
  }

  /** Holds the next `connect` resolution until the returned release is called. */
  holdNextConnect(): () => void {
    let release!: () => void;
    this.held = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async connect(): Promise<WalletAccount> {
    const held = this.held;
    this.held = null;
    if (held) await held;
    const failure = this.failure;
    this.failure = null;
    if (failure) throw new WalletError(failure, "fake wallet failure");
    if (!this.account) throw new WalletError("unavailable", "no wallet connected");
    return this.account;
  }

  async signTransaction(xdr: string): Promise<string> {
    return xdr;
  }
}

/**
 * Test-only in-memory `WalletPort` and `WalletConnectionPort`. No network, no
 * browser extension, no Supabase.
 *
 * `FakeWallet.connect` fails when no account is seeded (the "no wallet /
 * rejected" path) or when `failNextConnect` was called, and can be held so the
 * connecting state is observable. `signTransaction` is not exercised by the
 * onboarding wizard and simply returns the input XDR; `signMessage` records the
 * message it signed so the connect sequence can be asserted.
 *
 * `FakeWalletConnection` mirrors the HTTP adapter's observable contract: a
 * successful challenge, a submit that stores the submitted key, and a read that
 * returns it. It adds per-operation failures and call records for the
 * persistence tests.
 *
 * Not collected as a test suite: it has no `.test.` segment.
 */
import type { WalletBalancePort, WalletBalanceResult } from "@/application/ports/wallet-balance-port";
import {
  type WalletChallengeResult,
  type WalletConnection,
  type WalletConnectionErrorCode,
  type WalletConnectionInput,
  type WalletConnectionPort,
  type WalletConnectionResult,
  type WalletStateResult
} from "@/application/ports/wallet-connection-port";
import { WalletError, type WalletAccount, type WalletFailureKind, type WalletPort } from "@/application/ports/wallet-port";

const FAKE_CHALLENGE_ID = "11111111-1111-4111-8111-111111111111";
const FAKE_CHALLENGE_MESSAGE = "Vaqcrow wallet connection challenge\n\nNonce: fake-nonce";

export class FakeWallet implements WalletPort {
  private account: WalletAccount | null;
  private failure: WalletFailureKind | null = null;
  private signMessageFailure: WalletFailureKind | null = null;
  private held: Promise<void> | null = null;
  /** The messages passed to `signMessage`, in order. */
  readonly signedMessages: string[] = [];

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

  /** The next `signMessage` rejects with a `WalletError` of `kind`. */
  failNextSignMessage(kind: WalletFailureKind = "rejected"): void {
    this.signMessageFailure = kind;
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

  async signMessage(message: string): Promise<string> {
    this.signedMessages.push(message);
    const failure = this.signMessageFailure;
    this.signMessageFailure = null;
    if (failure) throw new WalletError(failure, "fake wallet failure");
    return `fake-signature:${message}`;
  }
}

export class FakeWalletConnection implements WalletConnectionPort {
  /** Inputs passed to `submitConnection`, in order. */
  readonly submitted: WalletConnectionInput[] = [];
  challengeCalls = 0;

  private state: { publicKey: string | null; frozen: boolean };
  private challengeFailure: WalletConnectionErrorCode | null = null;
  private submitFailure: WalletConnectionErrorCode | null = null;
  private getFailure: WalletConnectionErrorCode | null = null;

  constructor(state: { publicKey: string | null; frozen: boolean } = { publicKey: null, frozen: false }) {
    this.state = state;
  }

  /** Makes the read answer an already-linked account. */
  seedConnection(publicKey: string, frozen = false): void {
    this.state = { publicKey, frozen };
  }

  failNextChallenge(code: WalletConnectionErrorCode = "unavailable"): void {
    this.challengeFailure = code;
  }

  failNextSubmit(code: WalletConnectionErrorCode = "unavailable"): void {
    this.submitFailure = code;
  }

  failNextGet(code: WalletConnectionErrorCode = "unavailable"): void {
    this.getFailure = code;
  }

  async requestChallenge(): Promise<WalletChallengeResult> {
    this.challengeCalls += 1;
    const failure = this.challengeFailure;
    this.challengeFailure = null;
    if (failure) return { ok: false, code: failure };
    return { ok: true, challenge: { challengeId: FAKE_CHALLENGE_ID, message: FAKE_CHALLENGE_MESSAGE } };
  }

  async submitConnection(input: WalletConnectionInput): Promise<WalletConnectionResult> {
    this.submitted.push(input);
    const failure = this.submitFailure;
    this.submitFailure = null;
    if (failure) return { ok: false, code: failure };
    const connection: WalletConnection = { publicKey: input.publicKey, frozen: false };
    this.state = { publicKey: connection.publicKey, frozen: connection.frozen };
    return { ok: true, connection };
  }

  async getConnection(): Promise<WalletStateResult> {
    const failure = this.getFailure;
    this.getFailure = null;
    if (failure) return { ok: false, code: failure };
    return { ok: true, publicKey: this.state.publicKey, frozen: this.state.frozen };
  }
}

/**
 * Test-only `WalletBalancePort`. Defaults to the unfunded demo balance; seed a
 * different value to exercise the funded rendering.
 */
export class FakeWalletBalance implements WalletBalancePort {
  private balance = "0.0000000";
  private failure: "unavailable" | "network" | null = null;

  seedBalance(balanceXlm: string): void {
    this.balance = balanceXlm;
  }

  failNext(code: "unavailable" | "network" = "unavailable"): void {
    this.failure = code;
  }

  async getBalance(): Promise<WalletBalanceResult> {
    const failure = this.failure;
    this.failure = null;
    if (failure) return { ok: false, code: failure };
    return { ok: true, balanceXlm: this.balance };
  }
}

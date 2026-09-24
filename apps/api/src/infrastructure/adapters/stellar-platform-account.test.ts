import { Keypair, NotFoundError } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";
import { STELLAR_TESTNET_NETWORK_PASSPHRASE } from "../../application/config/stellar-config.js";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import { PlatformSigner } from "./platform-signer.js";
import { Secret } from "../../application/config/secret.js";
import { StellarPlatformAccount } from "./stellar-platform-account.js";
import type { HorizonPlatformAccountSource } from "./stellar-platform-account.js";

const PLATFORM_KEYPAIR = Keypair.random();
const SME_ACCOUNT_ID = Keypair.random().publicKey();

function config(overrides: Partial<StellarConfig> = {}): StellarConfig {
  return {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
    explorerUrl: "https://stellar.expert/explorer/testnet",
    ...overrides
  };
}

function signer(): PlatformSigner {
  return new PlatformSigner(new Secret(PLATFORM_KEYPAIR.secret()));
}

function noopSleep(): (ms: number) => Promise<void> {
  return vi.fn(async () => undefined);
}

describe("StellarPlatformAccount.accountExists", () => {
  it("reports true when Horizon resolves the account", async () => {
    const loadAccount = vi.fn().mockResolvedValue({ account_id: SME_ACCOUNT_ID, sequence: "1" });
    const source: HorizonPlatformAccountSource = {
      loadAccount,
      submitAsyncTransaction: vi.fn(),
      loadTransaction: vi.fn()
    };
    const adapter = new StellarPlatformAccount(config(), signer(), { source });

    const result = await adapter.accountExists(SME_ACCOUNT_ID);

    expect(result).toEqual({ ok: true, value: true });
    expect(loadAccount).toHaveBeenCalledWith(SME_ACCOUNT_ID);
  });

  it("reports false, not an error, when Horizon has never seen the account", async () => {
    const source: HorizonPlatformAccountSource = {
      loadAccount: vi.fn().mockRejectedValue(new NotFoundError("not found", {})),
      submitAsyncTransaction: vi.fn(),
      loadTransaction: vi.fn()
    };
    const adapter = new StellarPlatformAccount(config(), signer(), { source });

    const result = await adapter.accountExists(SME_ACCOUNT_ID);

    expect(result).toEqual({ ok: true, value: false });
  });

  it("maps a transport failure to unavailable, never Horizon's own error text", async () => {
    const source: HorizonPlatformAccountSource = {
      loadAccount: vi.fn().mockRejectedValue(new Error("ECONNRESET")),
      submitAsyncTransaction: vi.fn(),
      loadTransaction: vi.fn()
    };
    const adapter = new StellarPlatformAccount(config(), signer(), { source });

    const result = await adapter.accountExists(SME_ACCOUNT_ID);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

describe("StellarPlatformAccount.createAccount", () => {
  it("builds, signs with the platform key and submits a CreateAccount, then waits for it to settle", async () => {
    const loadAccount = vi
      .fn()
      .mockResolvedValueOnce({ account_id: PLATFORM_KEYPAIR.publicKey(), sequence: "41" });
    const submitAsyncTransaction = vi.fn().mockResolvedValue({ hash: "deadbeef", tx_status: "PENDING" });
    const loadTransaction = vi.fn().mockResolvedValue({ successful: true });
    const source: HorizonPlatformAccountSource = { loadAccount, submitAsyncTransaction, loadTransaction };
    const adapter = new StellarPlatformAccount(config(), signer(), { source, sleep: noopSleep() });

    const result = await adapter.createAccount({
      destination: SME_ACCOUNT_ID,
      startingBalanceStroops: 20_000_000n
    });

    expect(result).toEqual({ ok: true, value: { hash: "deadbeef" } });
    expect(loadAccount).toHaveBeenCalledWith(PLATFORM_KEYPAIR.publicKey());

    const submittedTransaction = submitAsyncTransaction.mock.calls[0]?.[0];
    expect(submittedTransaction.operations).toHaveLength(1);
    expect(submittedTransaction.operations[0].type).toBe("createAccount");
    expect(submittedTransaction.operations[0].destination).toBe(SME_ACCOUNT_ID);
    expect(submittedTransaction.operations[0].startingBalance).toBe("2.0000000");
    expect(submittedTransaction.signatures).toHaveLength(1);
  });

  it("polls until the submission settles instead of treating pending as an error", async () => {
    const loadAccount = vi.fn().mockResolvedValue({ account_id: PLATFORM_KEYPAIR.publicKey(), sequence: "41" });
    const submitAsyncTransaction = vi.fn().mockResolvedValue({ hash: "deadbeef", tx_status: "PENDING" });
    const loadTransaction = vi
      .fn()
      .mockRejectedValueOnce(new NotFoundError("not found", {}))
      .mockResolvedValueOnce({ successful: true });
    const source: HorizonPlatformAccountSource = { loadAccount, submitAsyncTransaction, loadTransaction };
    const adapter = new StellarPlatformAccount(config(), signer(), { source, sleep: noopSleep() });

    const result = await adapter.createAccount({
      destination: SME_ACCOUNT_ID,
      startingBalanceStroops: 20_000_000n
    });

    expect(result).toEqual({ ok: true, value: { hash: "deadbeef" } });
    expect(loadTransaction).toHaveBeenCalledTimes(2);
  });

  it("reports unavailable when the submission never settles within the bounded poll", async () => {
    const loadAccount = vi.fn().mockResolvedValue({ account_id: PLATFORM_KEYPAIR.publicKey(), sequence: "41" });
    const submitAsyncTransaction = vi.fn().mockResolvedValue({ hash: "deadbeef", tx_status: "PENDING" });
    const loadTransaction = vi.fn().mockRejectedValue(new NotFoundError("not found", {}));
    const source: HorizonPlatformAccountSource = { loadAccount, submitAsyncTransaction, loadTransaction };
    const adapter = new StellarPlatformAccount(config(), signer(), {
      source,
      sleep: noopSleep(),
      maxPollAttempts: 2
    });

    const result = await adapter.createAccount({
      destination: SME_ACCOUNT_ID,
      startingBalanceStroops: 20_000_000n
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(loadTransaction).toHaveBeenCalledTimes(2);
  });

  it("reports unavailable when the ledger settles the submission as unsuccessful", async () => {
    const loadAccount = vi.fn().mockResolvedValue({ account_id: PLATFORM_KEYPAIR.publicKey(), sequence: "41" });
    const submitAsyncTransaction = vi.fn().mockResolvedValue({ hash: "deadbeef", tx_status: "PENDING" });
    const loadTransaction = vi.fn().mockResolvedValue({ successful: false });
    const source: HorizonPlatformAccountSource = { loadAccount, submitAsyncTransaction, loadTransaction };
    const adapter = new StellarPlatformAccount(config(), signer(), { source, sleep: noopSleep() });

    const result = await adapter.createAccount({
      destination: SME_ACCOUNT_ID,
      startingBalanceStroops: 20_000_000n
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(loadTransaction).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable when core rejects the submission outright", async () => {
    const loadAccount = vi.fn().mockResolvedValue({ account_id: PLATFORM_KEYPAIR.publicKey(), sequence: "41" });
    const submitAsyncTransaction = vi.fn().mockResolvedValue({ hash: "deadbeef", tx_status: "ERROR" });
    const loadTransaction = vi.fn();
    const source: HorizonPlatformAccountSource = { loadAccount, submitAsyncTransaction, loadTransaction };
    const adapter = new StellarPlatformAccount(config(), signer(), { source, sleep: noopSleep() });

    const result = await adapter.createAccount({
      destination: SME_ACCOUNT_ID,
      startingBalanceStroops: 20_000_000n
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(loadTransaction).not.toHaveBeenCalled();
  });
});

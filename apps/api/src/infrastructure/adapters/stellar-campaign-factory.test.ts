import { Account, Keypair, StrKey, nativeToScVal, rpc } from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";
import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { STELLAR_TESTNET_NETWORK_PASSPHRASE } from "../../application/config/stellar-config.js";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import { Secret } from "../../application/config/secret.js";
import { PlatformSigner } from "./platform-signer.js";
import { StellarCampaignFactory } from "./stellar-campaign-factory.js";
import type { SorobanFactorySource } from "./stellar-campaign-factory.js";

const FACTORY_ID = StrKey.encodeContract(randomBytes(32));
const VAULT_ADDRESS = StrKey.encodeContract(randomBytes(32));
const SME_ACCOUNT_ID = Keypair.random().publicKey();
const TOKEN_CONTRACT_ID = StrKey.encodeContract(randomBytes(32));
const READ_SOURCE_ACCOUNT_ID = Keypair.random().publicKey();
const PLATFORM_KEYPAIR = Keypair.random();
const SALT = new Uint8Array(randomBytes(32));

function config(): StellarConfig & { readonly factoryId: string; readonly readSourceAccountId: string } {
  return {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
    explorerUrl: "https://stellar.expert/explorer/testnet",
    factoryId: FACTORY_ID,
    readSourceAccountId: READ_SOURCE_ACCOUNT_ID
  };
}

function signer(): PlatformSigner {
  return new PlatformSigner(new Secret(PLATFORM_KEYPAIR.secret()));
}

function simulationBase() {
  return { id: "1", latestLedger: 1, events: [], _parsed: true, transactionData: {} as never, minResourceFee: "100" };
}

function successResult(retval: ReturnType<typeof nativeToScVal>): rpc.Api.SimulateTransactionSuccessResponse {
  return { ...simulationBase(), result: { retval, auth: [] } };
}

function noopSleep(): (ms: number) => Promise<void> {
  return vi.fn(async () => undefined);
}

function baseSource(overrides: Partial<SorobanFactorySource> = {}): SorobanFactorySource {
  return {
    simulateTransaction: vi.fn(),
    getAccount: vi.fn(),
    prepareTransaction: vi.fn(),
    sendTransaction: vi.fn(),
    getTransaction: vi.fn(),
    ...overrides
  };
}

describe("StellarCampaignFactory.predict", () => {
  it("reads the deterministic vault address for a salt without deploying it", async () => {
    const simulateTransaction = vi.fn().mockResolvedValue(successResult(nativeToScVal(VAULT_ADDRESS, { type: "address" })));
    const adapter = new StellarCampaignFactory(config(), signer(), { source: baseSource({ simulateTransaction }) });

    const result = await adapter.predict(SALT);

    expect(result).toEqual({ ok: true, value: VAULT_ADDRESS });
    const transaction = simulateTransaction.mock.calls[0]?.[0] as Transaction;
    expect(transaction.operations).toHaveLength(1);
  });

  it("maps a simulation failure to unavailable", async () => {
    const simulateTransaction = vi.fn().mockResolvedValue({ ...simulationBase(), error: "boom" });
    const adapter = new StellarCampaignFactory(config(), signer(), { source: baseSource({ simulateTransaction }) });

    const result = await adapter.predict(SALT);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

describe("StellarCampaignFactory.deploy", () => {
  function deployInput() {
    return {
      salt: SALT,
      smeAccountId: SME_ACCOUNT_ID,
      tokenContractId: TOKEN_CONTRACT_ID,
      goalStroops: 1_000_0000000n,
      deadline: new Date("2027-01-01T00:00:00.000Z")
    };
  }

  it("builds, prepares, signs with the platform key, submits and polls until the vault address is returned", async () => {
    const getAccount = vi.fn().mockResolvedValue(new Account(PLATFORM_KEYPAIR.publicKey(), "100"));
    const prepareTransaction = vi.fn().mockImplementation(async (tx: Transaction) => tx);
    const sendTransaction = vi.fn().mockResolvedValue({ status: "PENDING", hash: "cafebabe" });
    const getTransaction = vi.fn().mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.SUCCESS,
      returnValue: nativeToScVal(VAULT_ADDRESS, { type: "address" })
    });
    const source = baseSource({ getAccount, prepareTransaction, sendTransaction, getTransaction });
    const adapter = new StellarCampaignFactory(config(), signer(), { source, sleep: noopSleep() });

    const result = await adapter.deploy(deployInput());

    expect(result).toEqual({ ok: true, value: { contractAddress: VAULT_ADDRESS, hash: "cafebabe" } });

    const prepared = prepareTransaction.mock.calls[0]?.[0] as Transaction;
    expect(prepared.operations).toHaveLength(1);

    const sent = sendTransaction.mock.calls[0]?.[0] as Transaction;
    expect(sent.signatures).toHaveLength(1);
    const [firstSignature] = sent.signatures;
    expect(firstSignature).toBeDefined();
    expect(
      Keypair.fromPublicKey(PLATFORM_KEYPAIR.publicKey()).verify(sent.hash(), firstSignature?.signature ?? Buffer.alloc(0))
    ).toBe(true);
  });

  it("polls until the deployment settles instead of treating pending as an error", async () => {
    const getAccount = vi.fn().mockResolvedValue(new Account(PLATFORM_KEYPAIR.publicKey(), "100"));
    const prepareTransaction = vi.fn().mockImplementation(async (tx: Transaction) => tx);
    const sendTransaction = vi.fn().mockResolvedValue({ status: "PENDING", hash: "cafebabe" });
    const getTransaction = vi
      .fn()
      .mockResolvedValueOnce({ status: rpc.Api.GetTransactionStatus.NOT_FOUND })
      .mockResolvedValueOnce({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
        returnValue: nativeToScVal(VAULT_ADDRESS, { type: "address" })
      });
    const source = baseSource({ getAccount, prepareTransaction, sendTransaction, getTransaction });
    const adapter = new StellarCampaignFactory(config(), signer(), { source, sleep: noopSleep() });

    const result = await adapter.deploy(deployInput());

    expect(result).toEqual({ ok: true, value: { contractAddress: VAULT_ADDRESS, hash: "cafebabe" } });
    expect(getTransaction).toHaveBeenCalledTimes(2);
  });

  it("reports unavailable when the deployment settles as failed", async () => {
    const getAccount = vi.fn().mockResolvedValue(new Account(PLATFORM_KEYPAIR.publicKey(), "100"));
    const prepareTransaction = vi.fn().mockImplementation(async (tx: Transaction) => tx);
    const sendTransaction = vi.fn().mockResolvedValue({ status: "PENDING", hash: "cafebabe" });
    const getTransaction = vi.fn().mockResolvedValue({ status: rpc.Api.GetTransactionStatus.FAILED });
    const source = baseSource({ getAccount, prepareTransaction, sendTransaction, getTransaction });
    const adapter = new StellarCampaignFactory(config(), signer(), { source, sleep: noopSleep() });

    const result = await adapter.deploy(deployInput());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("reports unavailable when core rejects the submission outright, never polling", async () => {
    const getAccount = vi.fn().mockResolvedValue(new Account(PLATFORM_KEYPAIR.publicKey(), "100"));
    const prepareTransaction = vi.fn().mockImplementation(async (tx: Transaction) => tx);
    const sendTransaction = vi.fn().mockResolvedValue({ status: "ERROR", hash: "cafebabe" });
    const getTransaction = vi.fn();
    const source = baseSource({ getAccount, prepareTransaction, sendTransaction, getTransaction });
    const adapter = new StellarCampaignFactory(config(), signer(), { source, sleep: noopSleep() });

    const result = await adapter.deploy(deployInput());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(getTransaction).not.toHaveBeenCalled();
  });

  it("rejects a malformed SME account id as invalid_input, before touching the network", async () => {
    const getAccount = vi.fn();
    const adapter = new StellarCampaignFactory(config(), signer(), { source: baseSource({ getAccount }) });

    const result = await adapter.deploy({ ...deployInput(), smeAccountId: "not-a-stellar-account" });

    expect(result).toEqual({ ok: false, error: { code: "invalid_input" } });
    expect(getAccount).not.toHaveBeenCalled();
  });
});

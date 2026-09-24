import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc
} from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContractOperationName } from "../../application/ports/campaign-vault-invocation-port.js";
import { StellarCampaignVaultInvocation } from "./stellar-campaign-vault-invocation.js";
import type { SorobanInvocationSource } from "./stellar-campaign-vault-invocation.js";

/**
 * Every `verify` test runs offline against a real, locally-signed envelope —
 * no RPC double is involved there, matching `stellar-funding-intent-xdr.test.ts`.
 * `prepare`/`submit`/`findResult` do go through the narrow `SorobanInvocationSource`
 * double, since those are genuinely I/O.
 */

const NETWORK_PASSPHRASE = Networks.TESTNET;
const OTHER_NETWORK_PASSPHRASE = "Vaqcrow Test Network ; September 2026";

const NOW_SECONDS = 1_800_000_000;
const MAX_TIME = NOW_SECONDS + 900;

const SOURCE_SEQUENCE = "123456789";
const AMOUNT_STROOPS = 10_0000000n;

const contractKeypairSeed = () => StrKey.encodeContract(randomBytes(32));
const CONTRACT_ADDRESS = contractKeypairSeed();
const OTHER_CONTRACT_ADDRESS = contractKeypairSeed();

const sourceKeypair = Keypair.random();
const investorKeypair = Keypair.random();
const otherKeypair = Keypair.random();

const invocationPort = new StellarCampaignVaultInvocation({
  network: "testnet",
  horizonUrl: "https://horizon-testnet.stellar.org",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: NETWORK_PASSPHRASE,
  explorerUrl: "https://stellar.expert/explorer/testnet"
});

interface BuildOptions {
  readonly contractAddress?: string;
  readonly operation?: ContractOperationName;
  readonly sourceAccountId?: string;
  readonly investorAccountId?: string;
  readonly amountStroops?: bigint;
  readonly maxTime?: number;
  readonly networkPassphrase?: string;
}

function argsFor(operation: ContractOperationName, investorAccountId: string, amountStroops: bigint) {
  const investor = new Address(investorAccountId).toScVal();
  return operation === "contribute" ? [investor, nativeToScVal(amountStroops, { type: "i128" })] : [investor];
}

function buildUnsigned(options: BuildOptions = {}): Transaction {
  const operation = options.operation ?? "contribute";
  const contractAddress = options.contractAddress ?? CONTRACT_ADDRESS;
  const sourceAccountId = options.sourceAccountId ?? sourceKeypair.publicKey();
  const investorAccountId = options.investorAccountId ?? investorKeypair.publicKey();
  const amountStroops = options.amountStroops ?? AMOUNT_STROOPS;
  const maxTime = options.maxTime ?? MAX_TIME;
  const networkPassphrase = options.networkPassphrase ?? NETWORK_PASSPHRASE;

  const contract = new Contract(contractAddress);

  return new TransactionBuilder(new Account(sourceAccountId, SOURCE_SEQUENCE), {
    fee: BASE_FEE,
    networkPassphrase,
    timebounds: { minTime: "0", maxTime: String(maxTime) }
  })
    .addOperation(contract.call(operation, ...argsFor(operation, investorAccountId, amountStroops)))
    .build();
}

function signed(options: BuildOptions = {}, signer: Keypair = sourceKeypair): string {
  const transaction = buildUnsigned(options);
  transaction.sign(signer);
  return transaction.toXdr();
}

function verifyInput(
  signedXdr: string,
  overrides: Partial<{
    contractAddress: string;
    operation: ContractOperationName;
    investorAccountId: string;
    amountStroops: bigint | undefined;
    sourceAccountId: string | undefined;
  }> = {}
) {
  const { amountStroops, sourceAccountId, ...rest } = {
    contractAddress: CONTRACT_ADDRESS,
    operation: "contribute" as ContractOperationName,
    investorAccountId: investorKeypair.publicKey(),
    amountStroops: AMOUNT_STROOPS as bigint | undefined,
    sourceAccountId: sourceKeypair.publicKey() as string | undefined,
    ...overrides
  };

  // `exactOptionalPropertyTypes` refuses an explicit `undefined` on an
  // optional field, so a test that wants to omit `amountStroops`/
  // `sourceAccountId` entirely (rather than pass a concrete value) has that
  // key left out here, not set to `undefined`.
  return {
    signedXdr,
    networkPassphrase: NETWORK_PASSPHRASE,
    ...rest,
    ...(amountStroops === undefined ? {} : { amountStroops }),
    ...(sourceAccountId === undefined ? {} : { sourceAccountId })
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_SECONDS * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("StellarCampaignVaultInvocation.verify", () => {
  it("accepts a validly signed contribute envelope and reports its facts", () => {
    const decoded = buildUnsigned();
    const envelope = signed();

    const result = invocationPort.verify(verifyInput(envelope));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.transactionHash).toBe(Buffer.from(decoded.hash()).toString("hex"));
    expect(result.value.sourceAccountId).toBe(sourceKeypair.publicKey());
    expect(result.value.operation).toBe("contribute");
    expect(result.value.investorAccountId).toBe(investorKeypair.publicKey());
    expect(result.value.amountStroops).toBe(AMOUNT_STROOPS);
  });

  it("accepts a validly signed withdraw envelope with no amount", () => {
    const envelope = signed({ operation: "withdraw" });

    const result = invocationPort.verify(
      verifyInput(envelope, { operation: "withdraw", amountStroops: undefined })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amountStroops).toBeUndefined();
  });

  it("accepts a refund signed by any account, without an expected source", () => {
    // Permissionless: the platform (or anyone) can trigger a refund for the
    // investor named in the arguments — the source signs for itself only.
    const envelope = signed({ operation: "refund", sourceAccountId: otherKeypair.publicKey() }, otherKeypair);

    const result = invocationPort.verify(
      verifyInput(envelope, { operation: "refund", amountStroops: undefined, sourceAccountId: undefined })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sourceAccountId).toBe(otherKeypair.publicKey());
  });

  it("rejects malformed XDR", () => {
    expect(invocationPort.verify(verifyInput("not-a-transaction"))).toEqual({
      ok: false,
      refusal: { code: "malformed", reason: "envelope" }
    });
  });

  it("rejects a fee-bump envelope", () => {
    const inner = buildUnsigned();
    inner.sign(sourceKeypair);
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(otherKeypair, BASE_FEE, inner, NETWORK_PASSPHRASE);

    expect(invocationPort.verify(verifyInput(feeBump.toXdr()))).toEqual({
      ok: false,
      refusal: { code: "malformed", reason: "fee_bump" }
    });
  });

  it("rejects an envelope calling the wrong contract", () => {
    const envelope = signed({ contractAddress: OTHER_CONTRACT_ADDRESS });

    expect(invocationPort.verify(verifyInput(envelope))).toEqual({
      ok: false,
      refusal: { code: "wrong_contract" }
    });
  });

  it("rejects an envelope calling the wrong function", () => {
    const envelope = signed({ operation: "withdraw" });

    expect(invocationPort.verify(verifyInput(envelope, { operation: "contribute" }))).toEqual({
      ok: false,
      refusal: { code: "wrong_function" }
    });
  });

  it("rejects a tampered amount argument", () => {
    const envelope = signed({ amountStroops: AMOUNT_STROOPS });

    expect(invocationPort.verify(verifyInput(envelope, { amountStroops: AMOUNT_STROOPS + 1n }))).toEqual({
      ok: false,
      refusal: { code: "wrong_arguments" }
    });
  });

  it("rejects a tampered investor argument", () => {
    const envelope = signed({ investorAccountId: investorKeypair.publicKey() });

    expect(invocationPort.verify(verifyInput(envelope, { investorAccountId: otherKeypair.publicKey() }))).toEqual({
      ok: false,
      refusal: { code: "wrong_arguments" }
    });
  });

  it("rejects an envelope signed by, and sourced from, an unexpected account", () => {
    const envelope = signed({ sourceAccountId: otherKeypair.publicKey() }, otherKeypair);

    expect(invocationPort.verify(verifyInput(envelope))).toEqual({
      ok: false,
      refusal: { code: "wrong_source" }
    });
  });

  it("rejects an envelope with no signature", () => {
    const envelope = buildUnsigned().toXdr();

    expect(invocationPort.verify(verifyInput(envelope))).toEqual({
      ok: false,
      refusal: { code: "bad_signature", reason: "missing" }
    });
  });

  it("rejects a source account that signed with a different key than its own", () => {
    // `source` on the envelope matches the expected source, but the actual
    // signature was produced by a different keypair — a distinct failure
    // from `wrong_source` (where the envelope names a different source
    // account outright).
    const envelope = signed({}, otherKeypair);

    expect(invocationPort.verify(verifyInput(envelope))).toEqual({
      ok: false,
      refusal: { code: "bad_signature", reason: "signature" }
    });
  });

  it("rejects a signature valid only for another network", () => {
    const unsigned = buildUnsigned();
    const retagged = TransactionBuilder.fromXDR(unsigned.toXdr(), OTHER_NETWORK_PASSPHRASE) as Transaction;
    retagged.sign(sourceKeypair);

    expect(invocationPort.verify(verifyInput(retagged.toXdr()))).toEqual({
      ok: false,
      refusal: { code: "bad_signature", reason: "signature" }
    });
  });

  it("rejects an envelope whose time bounds already expired", () => {
    const envelope = signed({ maxTime: NOW_SECONDS - 1 });

    expect(invocationPort.verify(verifyInput(envelope))).toEqual({
      ok: false,
      refusal: { code: "expired", reason: "timebounds" }
    });
  });

  it("rejects a verify call whose expected input is inconsistent (contribute with no amount)", () => {
    const envelope = signed();

    expect(invocationPort.verify(verifyInput(envelope, { amountStroops: undefined }))).toEqual({
      ok: false,
      refusal: { code: "malformed", reason: "expected_arguments" }
    });
  });
});

function doubleSource(overrides: Partial<SorobanInvocationSource> = {}): SorobanInvocationSource {
  return {
    getAccount: vi.fn().mockResolvedValue(new Account(sourceKeypair.publicKey(), "100")),
    prepareTransaction: vi.fn(async (tx: Transaction) => tx),
    sendTransaction: vi.fn(),
    getTransaction: vi.fn(),
    ...overrides
  };
}

function config() {
  return {
    network: "testnet" as const,
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: NETWORK_PASSPHRASE,
    explorerUrl: "https://stellar.expert/explorer/testnet"
  };
}

describe("StellarCampaignVaultInvocation.prepare", () => {
  it("builds an unsigned, simulated contribute invocation", async () => {
    const source = doubleSource();
    const port = new StellarCampaignVaultInvocation(config(), source);

    const result = await port.prepare({
      contractAddress: CONTRACT_ADDRESS,
      operation: "contribute",
      sourceAccountId: sourceKeypair.publicKey(),
      investorAccountId: investorKeypair.publicKey(),
      amountStroops: AMOUNT_STROOPS
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decoded = TransactionBuilder.fromXDR(result.value.xdr, NETWORK_PASSPHRASE) as Transaction;
    expect(decoded.source).toBe(sourceKeypair.publicKey());
    expect(decoded.signatures).toHaveLength(0);
    expect(result.value.networkPassphrase).toBe(NETWORK_PASSPHRASE);
    expect(new Date(result.value.expiresAt).getTime()).toBeGreaterThan(NOW_SECONDS * 1000);
    expect(source.getAccount).toHaveBeenCalledWith(sourceKeypair.publicKey());
    expect(source.prepareTransaction).toHaveBeenCalledTimes(1);
  });

  it("rejects a contribute request with no amount", async () => {
    const port = new StellarCampaignVaultInvocation(config(), doubleSource());

    const result = await port.prepare({
      contractAddress: CONTRACT_ADDRESS,
      operation: "contribute",
      sourceAccountId: sourceKeypair.publicKey(),
      investorAccountId: investorKeypair.publicKey()
    });

    expect(result).toEqual({ ok: false, error: { code: "invalid_input", reason: "arguments" } });
  });

  it("rejects a withdraw request that carries an amount", async () => {
    const port = new StellarCampaignVaultInvocation(config(), doubleSource());

    const result = await port.prepare({
      contractAddress: CONTRACT_ADDRESS,
      operation: "withdraw",
      sourceAccountId: sourceKeypair.publicKey(),
      investorAccountId: investorKeypair.publicKey(),
      amountStroops: AMOUNT_STROOPS
    });

    expect(result).toEqual({ ok: false, error: { code: "invalid_input", reason: "arguments" } });
  });

  it("maps a getAccount failure to unavailable", async () => {
    const source = doubleSource({ getAccount: vi.fn().mockRejectedValue(new Error("network down")) });
    const port = new StellarCampaignVaultInvocation(config(), source);

    const result = await port.prepare({
      contractAddress: CONTRACT_ADDRESS,
      operation: "withdraw",
      sourceAccountId: sourceKeypair.publicKey(),
      investorAccountId: investorKeypair.publicKey()
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a prepareTransaction (simulation) failure to unavailable", async () => {
    const source = doubleSource({ prepareTransaction: vi.fn().mockRejectedValue(new Error("simulation failed")) });
    const port = new StellarCampaignVaultInvocation(config(), source);

    const result = await port.prepare({
      contractAddress: CONTRACT_ADDRESS,
      operation: "withdraw",
      sourceAccountId: sourceKeypair.publicKey(),
      investorAccountId: investorKeypair.publicKey()
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

function sendResponse(overrides: Partial<rpc.Api.SendTransactionResponse> = {}): rpc.Api.SendTransactionResponse {
  return { status: "PENDING", hash: "abc123", latestLedger: 1, latestLedgerCloseTime: 1, ...overrides };
}

describe("StellarCampaignVaultInvocation.submit", () => {
  it("classifies PENDING and DUPLICATE as accepted", async () => {
    for (const status of ["PENDING", "DUPLICATE"] as const) {
      const source = doubleSource({ sendTransaction: vi.fn().mockResolvedValue(sendResponse({ status })) });
      const port = new StellarCampaignVaultInvocation(config(), source);

      const result = await port.submit(signed());

      expect(result).toEqual({ ok: true, value: { hash: "abc123", status: "accepted" } });
    }
  });

  it("classifies ERROR as rejected", async () => {
    const source = doubleSource({ sendTransaction: vi.fn().mockResolvedValue(sendResponse({ status: "ERROR" })) });
    const port = new StellarCampaignVaultInvocation(config(), source);

    const result = await port.submit(signed());

    expect(result).toEqual({ ok: true, value: { hash: "abc123", status: "rejected" } });
  });

  it("classifies TRY_AGAIN_LATER as unavailable", async () => {
    const source = doubleSource({
      sendTransaction: vi.fn().mockResolvedValue(sendResponse({ status: "TRY_AGAIN_LATER" }))
    });
    const port = new StellarCampaignVaultInvocation(config(), source);

    const result = await port.submit(signed());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("rejects an undecodable envelope as invalid_input without calling the network", async () => {
    const source = doubleSource();
    const port = new StellarCampaignVaultInvocation(config(), source);

    const result = await port.submit("not-a-transaction");

    expect(result).toEqual({ ok: false, error: { code: "invalid_input" } });
    expect(source.sendTransaction).not.toHaveBeenCalled();
  });

  it("refuses to submit a fee-bump envelope", async () => {
    const inner = buildUnsigned();
    inner.sign(sourceKeypair);
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(otherKeypair, BASE_FEE, inner, NETWORK_PASSPHRASE);
    const source = doubleSource();
    const port = new StellarCampaignVaultInvocation(config(), source);

    const result = await port.submit(feeBump.toXdr());

    expect(result).toEqual({ ok: false, error: { code: "invalid_input" } });
    expect(source.sendTransaction).not.toHaveBeenCalled();
  });

  it("maps a transport failure to unavailable", async () => {
    const source = doubleSource({ sendTransaction: vi.fn().mockRejectedValue(new Error("ECONNRESET")) });
    const port = new StellarCampaignVaultInvocation(config(), source);

    const result = await port.submit(signed());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

describe("StellarCampaignVaultInvocation.findResult", () => {
  function txResponse(status: rpc.Api.GetTransactionStatus): rpc.Api.GetTransactionResponse {
    return {
      status,
      txHash: "abc123",
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      oldestLedgerCloseTime: 1
    } as rpc.Api.GetTransactionResponse;
  }

  it("maps NOT_FOUND to pending", async () => {
    const source = doubleSource({
      getTransaction: vi.fn().mockResolvedValue(txResponse(rpc.Api.GetTransactionStatus.NOT_FOUND))
    });
    const port = new StellarCampaignVaultInvocation(config(), source);

    expect(await port.findResult("abc123")).toEqual({ ok: true, value: { status: "pending" } });
  });

  it("maps SUCCESS to success", async () => {
    const source = doubleSource({
      getTransaction: vi.fn().mockResolvedValue(txResponse(rpc.Api.GetTransactionStatus.SUCCESS))
    });
    const port = new StellarCampaignVaultInvocation(config(), source);

    expect(await port.findResult("abc123")).toEqual({ ok: true, value: { status: "success" } });
  });

  it("maps FAILED to failed", async () => {
    const source = doubleSource({
      getTransaction: vi.fn().mockResolvedValue(txResponse(rpc.Api.GetTransactionStatus.FAILED))
    });
    const port = new StellarCampaignVaultInvocation(config(), source);

    expect(await port.findResult("abc123")).toEqual({ ok: true, value: { status: "failed" } });
  });

  it("maps a transport failure to unavailable", async () => {
    const source = doubleSource({ getTransaction: vi.fn().mockRejectedValue(new Error("ECONNRESET")) });
    const port = new StellarCampaignVaultInvocation(config(), source);

    expect(await port.findResult("abc123")).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

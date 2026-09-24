import { Keypair, StrKey, nativeToScVal } from "@stellar/stellar-sdk";
import type { rpc } from "@stellar/stellar-sdk";
import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { STELLAR_TESTNET_NETWORK_PASSPHRASE } from "../../application/config/stellar-config.js";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import { StellarCampaignVaultChain } from "./stellar-campaign-vault-chain.js";
import type { SorobanReadSource } from "./stellar-campaign-vault-chain.js";

/**
 * Every read is simulation-only: the double never sees a submission, and
 * `readSourceAccountId` is a throwaway account — nothing here asserts on its
 * sequence, matching the adapter's own doc that it is never fetched.
 */

const CONTRACT_ADDRESS = StrKey.encodeContract(randomBytes(32));
const SME_ACCOUNT_ID = Keypair.random().publicKey();
const TOKEN_CONTRACT_ID = StrKey.encodeContract(randomBytes(32));
const INVESTOR_ACCOUNT_ID = Keypair.random().publicKey();
const READ_SOURCE_ACCOUNT_ID = Keypair.random().publicKey();

function config(overrides: Partial<StellarConfig> = {}): StellarConfig & { readSourceAccountId: string } {
  return {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
    explorerUrl: "https://stellar.expert/explorer/testnet",
    readSourceAccountId: READ_SOURCE_ACCOUNT_ID,
    ...overrides
  };
}

/** Every field on a base success response this adapter never inspects. */
function simulationBase() {
  return { id: "1", latestLedger: 1, events: [], _parsed: true, transactionData: {} as never, minResourceFee: "100" };
}

function successResult(retval: ReturnType<typeof nativeToScVal>): rpc.Api.SimulateTransactionSuccessResponse {
  return { ...simulationBase(), result: { retval, auth: [] } };
}

function errorResult(message: string): rpc.Api.SimulateTransactionErrorResponse {
  return { ...simulationBase(), error: message };
}

/** Queues canned simulation responses, returned in the order the adapter calls `simulateTransaction`. */
function queuedSource(responses: rpc.Api.SimulateTransactionResponse[]): SorobanReadSource {
  let index = 0;
  return {
    simulateTransaction: vi.fn(async () => {
      const response = responses[index];
      index += 1;
      if (response === undefined) {
        throw new Error("no more canned responses");
      }
      return response;
    })
  };
}

const FULL_CAMPAIGN_RESPONSES = [
  successResult(nativeToScVal(0, { type: "u32" })), // state
  successResult(nativeToScVal(500_0000000n, { type: "i128" })), // total
  successResult(nativeToScVal(1000_0000000n, { type: "i128" })), // goal
  successResult(nativeToScVal(4102444800n, { type: "u64" })), // deadline
  successResult(nativeToScVal(SME_ACCOUNT_ID, { type: "address" })), // sme
  successResult(nativeToScVal(TOKEN_CONTRACT_ID, { type: "address" })) // token
];

describe("StellarCampaignVaultChain.readCampaign", () => {
  it("reads and decodes the full vault state, in state/total/goal/deadline/sme/token order", async () => {
    const source = queuedSource(FULL_CAMPAIGN_RESPONSES);
    const adapter = new StellarCampaignVaultChain(config(), source);

    const result = await adapter.readCampaign(CONTRACT_ADDRESS);

    if (!result.ok) {
      throw new Error(`expected success, got ${result.error.code}`);
    }

    expect(result.value.state).toBe("funding");
    expect(result.value.totalStroops).toBe(500_0000000n);
    expect(result.value.goalStroops).toBe(1000_0000000n);
    expect(result.value.deadline).toEqual(new Date(4102444800 * 1000));
    expect(result.value.smeAccountId).toBe(SME_ACCOUNT_ID);
    expect(result.value.tokenContractId).toBe(TOKEN_CONTRACT_ID);
    expect(result.value.observedAt).toBeInstanceOf(Date);
    expect(source.simulateTransaction).toHaveBeenCalledTimes(6);
  });

  it("decodes settled (1) and refunding (2) states", async () => {
    const settled = queuedSource([
      successResult(nativeToScVal(1, { type: "u32" })),
      ...FULL_CAMPAIGN_RESPONSES.slice(1)
    ]);
    const refunding = queuedSource([
      successResult(nativeToScVal(2, { type: "u32" })),
      ...FULL_CAMPAIGN_RESPONSES.slice(1)
    ]);

    const settledResult = await new StellarCampaignVaultChain(config(), settled).readCampaign(CONTRACT_ADDRESS);
    const refundingResult = await new StellarCampaignVaultChain(config(), refunding).readCampaign(CONTRACT_ADDRESS);

    expect(settledResult.ok && settledResult.value.state).toBe("settled");
    expect(refundingResult.ok && refundingResult.value.state).toBe("refunding");
  });

  it("maps a 'missing value' simulation error to not_found without leaking the RPC message", async () => {
    const source = queuedSource([errorResult("HostError: Error(Storage, MissingValue)")]);
    const adapter = new StellarCampaignVaultChain(config(), source);

    const result = await adapter.readCampaign(CONTRACT_ADDRESS);

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("maps any other simulation error to unavailable", async () => {
    const source = queuedSource([errorResult("HostError: Error(Budget, ExceededLimit)")]);
    const adapter = new StellarCampaignVaultChain(config(), source);

    const result = await adapter.readCampaign(CONTRACT_ADDRESS);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a transport failure to unavailable", async () => {
    const source: SorobanReadSource = {
      simulateTransaction: vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    };
    const adapter = new StellarCampaignVaultChain(config(), source);

    const result = await adapter.readCampaign(CONTRACT_ADDRESS);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("stops at the first failing field instead of calling the rest", async () => {
    const source = queuedSource([errorResult("Error(Budget, ExceededLimit)")]);
    const adapter = new StellarCampaignVaultChain(config(), source);

    await adapter.readCampaign(CONTRACT_ADDRESS);

    expect(source.simulateTransaction).toHaveBeenCalledTimes(1);
  });
});

describe("StellarCampaignVaultChain.readContribution", () => {
  it("decodes the investor's running contribution", async () => {
    const source = queuedSource([successResult(nativeToScVal(250_0000000n, { type: "i128" }))]);
    const adapter = new StellarCampaignVaultChain(config(), source);

    const result = await adapter.readContribution(CONTRACT_ADDRESS, INVESTOR_ACCOUNT_ID);

    expect(result).toEqual({ ok: true, value: 250_0000000n });
  });

  it("returns zero for an investor who never contributed, not not_found", async () => {
    const source = queuedSource([successResult(nativeToScVal(0n, { type: "i128" }))]);
    const adapter = new StellarCampaignVaultChain(config(), source);

    const result = await adapter.readContribution(CONTRACT_ADDRESS, INVESTOR_ACCOUNT_ID);

    expect(result).toEqual({ ok: true, value: 0n });
  });

  it("rejects a malformed investor account id as unavailable rather than throwing", async () => {
    const source = queuedSource([]);
    const adapter = new StellarCampaignVaultChain(config(), source);

    const result = await adapter.readContribution(CONTRACT_ADDRESS, "not-an-account-id");

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

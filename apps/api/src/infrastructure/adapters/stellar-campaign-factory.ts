import { Account, Address, BASE_FEE, Contract, TransactionBuilder, nativeToScVal, rpc } from "@stellar/stellar-sdk";
import type { Transaction, xdr } from "@stellar/stellar-sdk";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import type {
  CampaignFactoryPort,
  CampaignFactoryResult,
  DeployCampaignVaultInput,
  DeployCampaignVaultOutcome
} from "../../application/ports/campaign-factory-port.js";
import { createSorobanRpcServer } from "./soroban-rpc.js";
import type { PlatformSigner } from "./platform-signer.js";

/** The slice of `rpc.Server` this adapter depends on — read (`predict`) and write (`deploy`) both go through Soroban RPC, mirroring `StellarCampaignVaultChain`/`StellarCampaignVaultInvocation`'s own split. */
export interface SorobanFactorySource {
  simulateTransaction(tx: Transaction): Promise<rpc.Api.SimulateTransactionResponse>;
  getAccount(accountId: string): Promise<Account>;
  prepareTransaction(tx: Transaction): Promise<Transaction>;
  sendTransaction(tx: Transaction): Promise<rpc.Api.SendTransactionResponse>;
  getTransaction(hash: string): Promise<rpc.Api.GetTransactionResponse>;
}

const READ_TIMEOUT_SECONDS = 30;
const DEPLOY_TIMEOUT_SECONDS = 60;
const DEFAULT_MAX_POLL_ATTEMPTS = 10;
const DEFAULT_POLL_INTERVAL_MS = 1000;

export interface StellarCampaignFactoryDeps {
  readonly source?: SorobanFactorySource;
  readonly maxPollAttempts?: number;
  readonly pollIntervalMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Opens campaign vaults through the on-chain factory
 * (`contracts/campaign-factory/src/lib.rs`).
 *
 * `predict` is a read-only simulation, the same shape
 * `StellarCampaignVaultChain` already uses for the vault's own getters: a
 * throwaway `readSourceAccountId` and a fixed sequence `"0"`, since
 * `simulateTransaction` never submits or validates the sequence.
 *
 * `deploy` is the one place this adapter signs anything, and it signs with
 * `PlatformSigner` (D8) exclusively — the factory's `deploy` entrypoint
 * requires `owner.require_auth()`, and the platform's account is that owner.
 * Bounded polling (`pollForContractAddress`) mirrors
 * `StellarCampaignVaultInvocation.findResult`'s own `NOT_FOUND`-is-pending
 * reasoning, but resolves all the way to the deployed address rather than
 * stopping at a bare status, since `open-campaign` needs the address to
 * write the mirror.
 */
export class StellarCampaignFactory implements CampaignFactoryPort {
  private readonly factoryId: string;
  private readonly networkPassphrase: string;
  private readonly readSourceAccountId: string;
  private readonly signer: PlatformSigner;
  private readonly source: SorobanFactorySource;
  private readonly maxPollAttempts: number;
  private readonly pollIntervalMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    config: StellarConfig & { readonly factoryId: string; readonly readSourceAccountId: string },
    signer: PlatformSigner,
    deps: StellarCampaignFactoryDeps = {}
  ) {
    this.factoryId = config.factoryId;
    this.networkPassphrase = config.networkPassphrase;
    this.readSourceAccountId = config.readSourceAccountId;
    this.signer = signer;
    this.source = deps.source ?? defaultFactorySource(config);
    this.maxPollAttempts = deps.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
    this.pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async predict(salt: Uint8Array): Promise<CampaignFactoryResult<string>> {
    let saltArg: xdr.ScVal;

    try {
      saltArg = nativeToScVal(salt, { type: "bytes" });
    } catch {
      return { ok: false, error: { code: "invalid_input" } };
    }

    const result = await this.callReadOnly("predict", [saltArg]);
    if (!result.ok) return result;

    try {
      return { ok: true, value: Address.fromScVal(result.value).toString() };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async deploy(input: DeployCampaignVaultInput): Promise<CampaignFactoryResult<DeployCampaignVaultOutcome>> {
    let args: xdr.ScVal[];

    try {
      args = [
        nativeToScVal(input.salt, { type: "bytes" }),
        new Address(input.smeAccountId).toScVal(),
        new Address(input.tokenContractId).toScVal(),
        nativeToScVal(input.goalStroops, { type: "i128" }),
        nativeToScVal(toDeadlineSeconds(input.deadline), { type: "u64" })
      ];
    } catch {
      return { ok: false, error: { code: "invalid_input" } };
    }

    let account: Account;

    try {
      account = await this.source.getAccount(this.signer.publicKey);
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }

    let unprepared: Transaction;

    try {
      const contract = new Contract(this.factoryId);
      unprepared = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call("deploy", ...args))
        .setTimeout(DEPLOY_TIMEOUT_SECONDS)
        .build();
    } catch {
      return { ok: false, error: { code: "invalid_input" } };
    }

    let prepared: Transaction;

    try {
      prepared = await this.source.prepareTransaction(unprepared);
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }

    this.signer.sign(prepared);

    let hash: string;

    try {
      const response = await this.source.sendTransaction(prepared);

      if (response.status === "ERROR" || response.status === "TRY_AGAIN_LATER") {
        return { ok: false, error: { code: "unavailable" } };
      }

      hash = response.hash;
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }

    return this.pollForContractAddress(hash);
  }

  private async pollForContractAddress(hash: string): Promise<CampaignFactoryResult<DeployCampaignVaultOutcome>> {
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt += 1) {
      let response: rpc.Api.GetTransactionResponse;

      try {
        response = await this.source.getTransaction(hash);
      } catch {
        return { ok: false, error: { code: "unavailable" } };
      }

      if (response.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        if (response.returnValue === undefined) {
          return { ok: false, error: { code: "unavailable" } };
        }

        try {
          return { ok: true, value: { contractAddress: Address.fromScVal(response.returnValue).toString(), hash } };
        } catch {
          return { ok: false, error: { code: "unavailable" } };
        }
      }

      if (response.status === rpc.Api.GetTransactionStatus.FAILED) {
        return { ok: false, error: { code: "unavailable" } };
      }

      await this.sleep(this.pollIntervalMs);
    }

    return { ok: false, error: { code: "unavailable" } };
  }

  private async callReadOnly(method: string, args: xdr.ScVal[]): Promise<CampaignFactoryResult<xdr.ScVal>> {
    let transaction: Transaction;

    try {
      const contract = new Contract(this.factoryId);
      transaction = new TransactionBuilder(new Account(this.readSourceAccountId, "0"), {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(method, ...args))
        .setTimeout(READ_TIMEOUT_SECONDS)
        .build();
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }

    let simulation: rpc.Api.SimulateTransactionResponse;

    try {
      simulation = await this.source.simulateTransaction(transaction);
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }

    if (rpc.Api.isSimulationError(simulation)) {
      return { ok: false, error: { code: "unavailable" } };
    }

    if (simulation.result?.retval === undefined) {
      return { ok: false, error: { code: "unavailable" } };
    }

    return { ok: true, value: simulation.result.retval };
  }
}

function toDeadlineSeconds(deadline: Date): bigint {
  return BigInt(Math.floor(deadline.getTime() / 1000));
}

function defaultFactorySource(config: StellarConfig): SorobanFactorySource {
  const server = createSorobanRpcServer(config);

  return {
    simulateTransaction: (transaction) => server.simulateTransaction(transaction),
    getAccount: (accountId) => server.getAccount(accountId),
    prepareTransaction: (transaction) => server.prepareTransaction(transaction),
    sendTransaction: (transaction) => server.sendTransaction(transaction),
    getTransaction: (hash) => server.getTransaction(hash)
  };
}

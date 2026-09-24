import { Account, Address, BASE_FEE, Contract, TransactionBuilder, rpc, scValToNative } from "@stellar/stellar-sdk";
import type { Transaction, xdr } from "@stellar/stellar-sdk";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import type {
  CampaignVaultChainErrorCode,
  CampaignVaultChainPort,
  CampaignVaultChainResult,
  VaultChainState,
  VaultChainStateName
} from "../../application/ports/campaign-vault-chain-port.js";
import { createSorobanRpcServer } from "./soroban-rpc.js";

/** The slice of `rpc.Server` this adapter depends on — simulation only, never a signature or a submission. */
export interface SorobanReadSource {
  simulateTransaction(tx: Transaction): Promise<rpc.Api.SimulateTransactionResponse>;
}

/** Generous, since a read is never time-critical the way a signed invocation's expiry is (`stellar-campaign-vault-invocation.ts`). */
const READ_TIMEOUT_SECONDS = 30;

/**
 * Reads the campaign vault contract's state through read-only Soroban RPC
 * simulation — no submission, no signature, and no fee is ever actually
 * charged for a simulated call.
 *
 * Every one of the contract's getters (`state`, `total`, `goal`, `deadline`,
 * `sme`, `token`, `contribution_of`) is its own entrypoint
 * (`contracts/campaign-vault/src/lib.rs`) with no combined accessor, so a full
 * `readCampaign` costs six simulated calls. They run in sequence — not
 * `Promise.all` — so the read order is deterministic and a test double can
 * assert on it without also having to decode which operation each call built.
 *
 * **The read-source account.** Simulating a transaction still requires a
 * syntactically valid source account and envelope — Soroban RPC has no
 * "just call this view function" primitive — even though nothing about a
 * read-only call depends on *which* account that is, or on its sequence:
 * `simulateTransaction` never validates the sequence, since the transaction
 * is never submitted. `readSourceAccountId` is therefore any Stellar account
 * id the deployment configures once (e.g. the platform's own account), and
 * every read is built against the fixed sequence `"0"` rather than fetching
 * the account's real sequence first — that would be an extra RPC round trip
 * to learn a number nothing here uses.
 *
 * **Decoding `State`.** The contract's `State` enum has explicit integer
 * discriminants and no associated data (`Funding = 0, Settled = 1,
 * Refunding = 2`) — soroban-sdk's `#[contracttype]` macro represents that
 * shape as a plain `ScVal::U32` on the wire, not as the `[Symbol, ...fields]`
 * vector it uses for a data-carrying enum. This is not independently
 * exercised against a live contract here (`#237`'s pull-request suite never
 * touches Testnet or a local network — see `CLAUDE.md`'s testing
 * philosophy), so it is a documented assumption rather than a verified fact
 * if this ever needs re-checking against a real deployment.
 */
export class StellarCampaignVaultChain implements CampaignVaultChainPort {
  private readonly networkPassphrase: string;
  private readonly readSourceAccountId: string;
  private readonly source: SorobanReadSource;

  constructor(
    config: StellarConfig & { readonly readSourceAccountId: string },
    source?: SorobanReadSource
  ) {
    this.networkPassphrase = config.networkPassphrase;
    this.readSourceAccountId = config.readSourceAccountId;
    this.source = source ?? defaultReadSource(config);
  }

  async readCampaign(contractAddress: string): Promise<CampaignVaultChainResult<VaultChainState>> {
    const observedAt = new Date();

    const state = await this.callReadOnly(contractAddress, "state");
    if (!state.ok) return state;

    const total = await this.callReadOnly(contractAddress, "total");
    if (!total.ok) return total;

    const goal = await this.callReadOnly(contractAddress, "goal");
    if (!goal.ok) return goal;

    const deadline = await this.callReadOnly(contractAddress, "deadline");
    if (!deadline.ok) return deadline;

    const sme = await this.callReadOnly(contractAddress, "sme");
    if (!sme.ok) return sme;

    const token = await this.callReadOnly(contractAddress, "token");
    if (!token.ok) return token;

    try {
      return {
        ok: true,
        value: {
          state: decodeState(state.value),
          totalStroops: decodeI128(total.value),
          goalStroops: decodeI128(goal.value),
          deadline: decodeDeadline(deadline.value),
          smeAccountId: decodeAddress(sme.value),
          tokenContractId: decodeAddress(token.value),
          observedAt
        }
      };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async readContribution(
    contractAddress: string,
    investorAccountId: string
  ): Promise<CampaignVaultChainResult<bigint>> {
    let investorArg: xdr.ScVal;

    try {
      investorArg = new Address(investorAccountId).toScVal();
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }

    const result = await this.callReadOnly(contractAddress, "contribution_of", [investorArg]);
    if (!result.ok) return result;

    try {
      return { ok: true, value: decodeI128(result.value) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private async callReadOnly(
    contractAddress: string,
    method: string,
    args: xdr.ScVal[] = []
  ): Promise<CampaignVaultChainResult<xdr.ScVal>> {
    let transaction: Transaction;

    try {
      const contract = new Contract(contractAddress);
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
      // The demo never surfaces the RPC's own diagnostic text to a caller —
      // only the coarse classification the port declares.
      return { ok: false, error: { code: classifySimulationError(simulation.error) } };
    }

    if (simulation.result?.retval === undefined) {
      return { ok: false, error: { code: "unavailable" } };
    }

    return { ok: true, value: simulation.result.retval };
  }
}

/**
 * A narrow, sanitized classification of the RPC's own error text. The
 * getters this adapter calls (`state`, `total`, …) all `unwrap()` their
 * storage entry in the contract, so a campaign whose constructor never ran —
 * the only way that unwrap panics — is the one case this adapter can tell
 * apart from a generic transient failure, by the diagnostic's own wording.
 */
function classifySimulationError(message: string): CampaignVaultChainErrorCode {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("missingvalue") ||
    normalized.includes("not found") ||
    normalized.includes("does not exist") ||
    normalized.includes("nonexistent")
  ) {
    return "not_found";
  }

  return "unavailable";
}

function decodeState(value: xdr.ScVal): VaultChainStateName {
  switch (Number(scValToNative(value))) {
    case 0:
      return "funding";
    case 1:
      return "settled";
    case 2:
      return "refunding";
    default:
      throw new Error("unrecognised vault state");
  }
}

function decodeI128(value: xdr.ScVal): bigint {
  const decoded = scValToNative(value);
  return typeof decoded === "bigint" ? decoded : BigInt(decoded as number);
}

function decodeDeadline(value: xdr.ScVal): Date {
  return new Date(Number(decodeI128(value)) * 1000);
}

/**
 * `scValToNative` has no dedicated conversion for `scvAddress` (the
 * documented table stops at bytes/symbol/string), so it would only "unwrap"
 * to the raw XDR — `Address.fromScVal` is the SDK's own decoder for this
 * shape and is used instead.
 */
function decodeAddress(value: xdr.ScVal): string {
  return Address.fromScVal(value).toString();
}

function defaultReadSource(config: StellarConfig): SorobanReadSource {
  const server = createSorobanRpcServer(config);
  return { simulateTransaction: (transaction) => server.simulateTransaction(transaction) };
}

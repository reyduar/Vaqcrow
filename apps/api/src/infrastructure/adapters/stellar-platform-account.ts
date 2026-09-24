import { Account, BASE_FEE, NotFoundError, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import type {
  CreateAccountInput,
  CreateAccountOutcome,
  StellarAccountPort,
  StellarAccountResult
} from "../../application/ports/stellar-account-port.js";
import { createHorizonServer } from "./stellar-horizon.js";
import { stroopsToXlm } from "./stellar-amounts.js";
import type { PlatformSigner } from "./platform-signer.js";

/**
 * The slice of `Horizon.Server` this adapter depends on.
 *
 * **Horizon, not Soroban RPC.** `CreateAccount` is a classic operation, and
 * this adapter's existence check reuses exactly the pattern `StellarLedger`
 * already established for reading a public account through Horizon
 * (`loadAccount` → `NotFoundError` means "not funded yet", not a failure).
 * Soroban RPC's own `getAccount` (used by `StellarCampaignVaultInvocation`
 * and `StellarCampaignFactory` to fetch a *source* account for building a
 * transaction) has no equivalent existence semantics worth duplicating here —
 * it exists to fetch a sequence number, not to answer "does this account
 * exist". Picking one transport for every classic-account concern, rather
 * than splitting reads across both, is what keeps this adapter's `not_found`
 * handling in one place.
 */
export interface HorizonPlatformAccountSource {
  loadAccount(accountId: string): Promise<{ readonly account_id: string; readonly sequence: string }>;
  submitAsyncTransaction(
    transaction: Transaction
  ): Promise<{ readonly hash: string; readonly tx_status: string }>;
  loadTransaction(hash: string): Promise<{ readonly successful: boolean }>;
}

const CREATE_ACCOUNT_TIMEOUT_SECONDS = 60;
const DEFAULT_MAX_POLL_ATTEMPTS = 10;
const DEFAULT_POLL_INTERVAL_MS = 1000;

export interface StellarPlatformAccountDeps {
  readonly source?: HorizonPlatformAccountSource;
  readonly maxPollAttempts?: number;
  readonly pollIntervalMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Reads and funds classic Stellar accounts on the platform's own authority.
 *
 * `accountExists` backs the vault-opening precondition documented on
 * `CampaignVault` (D2): the SME's account must exist before `factory.deploy`
 * runs, because a payout to a non-existent account would revert a
 * transaction that already carries other investors' contributions.
 * `createAccount` is how the platform satisfies that precondition itself —
 * `CreateAccount` needs no signature from the destination, only from the
 * funding account, which is why this never asks the SME to do anything.
 *
 * Signing goes through `PlatformSigner` (D8) exclusively; this file never
 * touches key material itself, matching every other adapter's own
 * never-signs-except-through-the-one-audited-file discipline.
 */
export class StellarPlatformAccount implements StellarAccountPort {
  private readonly networkPassphrase: string;
  private readonly signer: PlatformSigner;
  private readonly source: HorizonPlatformAccountSource;
  private readonly maxPollAttempts: number;
  private readonly pollIntervalMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config: StellarConfig, signer: PlatformSigner, deps: StellarPlatformAccountDeps = {}) {
    this.networkPassphrase = config.networkPassphrase;
    this.signer = signer;
    this.source = deps.source ?? defaultAccountSource(config);
    this.maxPollAttempts = deps.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
    this.pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async accountExists(accountId: string): Promise<StellarAccountResult<boolean>> {
    try {
      await this.source.loadAccount(accountId);
      return { ok: true, value: true };
    } catch (error) {
      if (isNotFound(error)) {
        return { ok: true, value: false };
      }

      // Sanitised on purpose: a Horizon failure carries the request URL and
      // the raw response body, neither of which belongs in a caller's error.
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async createAccount(input: CreateAccountInput): Promise<StellarAccountResult<CreateAccountOutcome>> {
    let platformAccount: { readonly account_id: string; readonly sequence: string };

    try {
      platformAccount = await this.source.loadAccount(this.signer.publicKey);
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }

    let transaction: Transaction;

    try {
      transaction = new TransactionBuilder(
        new Account(platformAccount.account_id, platformAccount.sequence),
        { fee: BASE_FEE, networkPassphrase: this.networkPassphrase }
      )
        .addOperation(
          Operation.createAccount({
            destination: input.destination,
            startingBalance: stroopsToXlm(input.startingBalanceStroops)
          })
        )
        .setTimeout(CREATE_ACCOUNT_TIMEOUT_SECONDS)
        .build();
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }

    this.signer.sign(transaction);

    let hash: string;

    try {
      const response = await this.source.submitAsyncTransaction(transaction);

      if (response.tx_status === "ERROR") {
        return { ok: false, error: { code: "unavailable" } };
      }

      hash = response.hash;
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }

    const settled = await this.pollForSuccess(hash);
    return settled ? { ok: true, value: { hash } } : { ok: false, error: { code: "unavailable" } };
  }

  /**
   * Bounded: an unfunded platform or a Testnet outage must not hang the
   * `open-campaign` use case forever. `NotFoundError` is Horizon's honest
   * answer for "not ingested yet" (same reasoning as `StellarTransaction`'s
   * own `findTransaction`) and keeps the poll going; any other outcome is
   * terminal, successful or not.
   */
  private async pollForSuccess(hash: string): Promise<boolean> {
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt += 1) {
      try {
        const record = await this.source.loadTransaction(hash);
        return record.successful;
      } catch (error) {
        if (!isNotFound(error)) {
          return false;
        }
      }

      await this.sleep(this.pollIntervalMs);
    }

    return false;
  }
}

/** Same 404-or-`NotFoundError` shape `StellarLedger` already checks for a classic account read. */
function isNotFound(error: unknown): boolean {
  if (error instanceof NotFoundError) {
    return true;
  }

  const status = (error as { response?: { status?: number } } | null | undefined)?.response?.status;
  return status === 404;
}

function defaultAccountSource(config: StellarConfig): HorizonPlatformAccountSource {
  const server = createHorizonServer(config);

  return {
    loadAccount: (accountId) => server.loadAccount(accountId),
    submitAsyncTransaction: (transaction) => server.submitAsyncTransaction(transaction),
    loadTransaction: (hash) => server.transactions().transaction(hash).call()
  };
}

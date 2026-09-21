import { NotFoundError } from "@stellar/stellar-sdk";
import type { StellarConfig, StellarNetwork } from "../../application/config/stellar-config.js";
import type { LedgerAccount, LedgerPort, LedgerResult } from "../../application/ports/ledger-port.js";
import { createHorizonServer } from "./stellar-horizon.js";
import { xlmToStroops } from "./stellar-amounts.js";

/**
 * The fields this adapter reads from a Horizon account record.
 *
 * `AccountResponse` satisfies this structurally, so the real client needs no
 * wrapper — but the narrow shape is what lets a deterministic double drive every
 * branch without the pull-request suite ever reaching Horizon.
 */
export interface HorizonAccountRecord {
  readonly account_id: string;
  readonly sequence: string;
  readonly balances: ReadonlyArray<{
    readonly asset_type: string;
    readonly balance: string;
  }>;
}

/** The slice of `Horizon.Server` this adapter depends on. */
export interface HorizonAccountSource {
  loadAccount(accountId: string): Promise<HorizonAccountRecord>;
}

/**
 * Reads public accounts from Stellar through Horizon.
 *
 * The adapter is constructed from validated configuration, so it cannot be
 * pointed at a network the rest of the process has not accepted — `#14` closed
 * configuration to Testnet, and this adapter inherits that boundary rather than
 * re-deciding it.
 *
 * There is no key material anywhere on this path: Horizon serves public data,
 * and Vaqcrow only ever needs an identity, a sequence number and a balance to
 * prepare a transaction that someone else will sign.
 */
export class StellarLedger implements LedgerPort {
  /** The network this ledger is bound to, taken from validated configuration. */
  readonly network: StellarNetwork;

  private readonly accounts: HorizonAccountSource;

  constructor(config: StellarConfig, accounts?: HorizonAccountSource) {
    this.network = config.network;
    this.accounts = accounts ?? createHorizonServer(config);
  }

  async getAccount(accountId: string): Promise<LedgerResult<LedgerAccount>> {
    let account: HorizonAccountRecord;

    try {
      account = await this.accounts.loadAccount(accountId);
    } catch (error) {
      if (isNotFound(error)) {
        return { ok: false, error: { code: "not_found" } };
      }

      // Sanitised on purpose. A Horizon failure carries the request URL and the
      // raw response body; neither belongs in a caller's error, and the caller
      // has nothing useful to do with them either.
      return { ok: false, error: { code: "unavailable" } };
    }

    // Conversion happens outside the guard: a malformed amount means the
    // response was wrong, not that Horizon was unavailable, and hiding that
    // difference would make a real anomaly look like a transient outage.
    return { ok: true, value: toLedgerAccount(account) };
  }
}

function toLedgerAccount(account: HorizonAccountRecord): LedgerAccount {
  const native = account.balances.find((balance) => balance.asset_type === "native");

  if (native === undefined) {
    throw new Error(`Horizon returned account ${account.account_id} without a native balance`);
  }

  return {
    accountId: account.account_id,
    sequence: account.sequence,
    nativeBalanceStroops: xlmToStroops(native.balance)
  };
}

/**
 * An unfunded account is a 404 from Horizon, surfaced either as the SDK's
 * `NotFoundError` or as a bare response shape. Both mean the same expected
 * thing: the address is valid and simply holds nothing yet.
 */
function isNotFound(error: unknown): boolean {
  if (error instanceof NotFoundError) {
    return true;
  }

  const status = (error as { response?: { status?: number } } | null | undefined)?.response?.status;
  return status === 404;
}

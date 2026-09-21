import {
  FeeBumpTransaction,
  NotFoundError,
  TransactionBuilder,
  TransactionFailedError
} from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";
import type { StellarFailureReason } from "@vaqcrow/contracts";
import type { StellarConfig, StellarNetwork } from "../../application/config/stellar-config.js";
import type {
  StellarSubmissionOutcome,
  StellarTransactionOutcome,
  StellarTransactionPort,
  StellarTransactionResult
} from "../../application/ports/stellar-transaction-port.js";
import { createHorizonServer } from "./stellar-horizon.js";

/**
 * The fields this adapter reads from a Horizon submission response.
 *
 * `SubmitAsyncTransactionResponse` satisfies this structurally, so the real
 * client needs no wrapper — but the narrow shape is what lets a deterministic
 * double drive every branch without the pull-request suite ever reaching
 * Horizon.
 */
export interface HorizonSubmitAsyncResponse {
  readonly hash: string;
  /**
   * stellar-core's own status, relayed by Horizon without waiting for a ledger.
   * The documented values are `PENDING`, `DUPLICATE`, `TRY_AGAIN_LATER` and
   * `ERROR`; the SDK types it as a bare `string`, so the adapter treats an
   * unknown value as transient rather than guessing.
   */
  readonly tx_status: string;
}

/** The fields this adapter reads from a Horizon transaction record. */
export interface HorizonTransactionRecord {
  readonly hash: string;
  /**
   * The ledger that included the transaction.
   *
   * Named `ledger_attr` because that is what the SDK calls it, and the name is
   * not cosmetic: on `ServerApi.TransactionRecord`, `ledger` is the **link** to
   * the ledger resource — a call function, not a number. The sequence lives on
   * `ledger_attr`. Keeping the SDK's own name here is what lets the real record
   * satisfy this shape structurally with no mapping, and it makes the mistake
   * impossible rather than merely unlikely: `record.ledger` would not type-check
   * against this field.
   */
  readonly ledger_attr: number;
  readonly successful: boolean;
  /** The including ledger's close time, as Horizon reports it. */
  readonly created_at: string;
}

/** The slice of `Horizon.Server` this adapter depends on. */
export interface HorizonTransactionSource {
  submitAsyncTransaction(transaction: Transaction): Promise<HorizonSubmitAsyncResponse>;
  loadTransaction(hash: string): Promise<HorizonTransactionRecord>;
}

/**
 * Horizon's result codes, reduced to the vocabulary the demo reports.
 *
 * This table is the *only* place Horizon's enum is allowed to be understood, and
 * it is deliberately partial: a code with no entry falls through to
 * `unsuccessful` rather than being passed along. Adding a row is a deliberate act
 * with a contract consequence, which is the point.
 */
const RESULT_CODE_REASONS: Readonly<Record<string, StellarFailureReason>> = {
  tx_bad_seq: "bad_sequence",
  tx_insufficient_fee: "insufficient_fee",
  tx_insufficient_balance: "insufficient_balance",
  tx_too_late: "expired",
  tx_too_early: "too_early"
};

/**
 * Submits signed envelopes to Stellar through Horizon and reads back what became
 * of them.
 *
 * **Why the asynchronous endpoint.** `POST /transactions` blocks until Horizon
 * has ingested the transaction, which means waiting for a ledger to close — on
 * Testnet, seconds, and on a bad day until it times out. The confirmation poll is
 * bounded and resumable, so a tick that can be held for an unbounded wait is the
 * wrong shape for it. `POST /transactions_async` relays stellar-core's answer
 * immediately and leaves the polling to us, which is exactly the architecture
 * `DEMO.md` describes and what makes `PENDING` an honest state to report.
 *
 * The cost of that choice is that a submission is no longer a verdict: core can
 * accept a transaction that never reaches a ledger. That is not a leak in the
 * design — it is the reason the poll exists, and the envelope's own `maxTime`
 * bounds it.
 */
export class StellarTransaction implements StellarTransactionPort {
  /** The network this adapter is bound to, taken from validated configuration. */
  readonly network: StellarNetwork;

  private readonly networkPassphrase: string;
  private readonly source: HorizonTransactionSource;

  constructor(config: StellarConfig, source?: HorizonTransactionSource) {
    this.network = config.network;
    this.networkPassphrase = config.networkPassphrase;
    this.source = source ?? horizonSource(config);
  }

  async submit(signedXdr: string): Promise<StellarTransactionResult<StellarSubmissionOutcome>> {
    let transaction: Transaction;

    try {
      transaction = this.decode(signedXdr);
    } catch {
      // The envelope is unusable, which is not a transient condition: retrying it
      // would retry the same malformed record forever.
      return { ok: false, error: { code: "invalid_input" } };
    }

    try {
      const response = await this.source.submitAsyncTransaction(transaction);
      return classifyStatus(response.tx_status);
    } catch (error) {
      return classifySubmissionFailure(error);
    }
  }

  async findTransaction(
    hash: string
  ): Promise<StellarTransactionResult<StellarTransactionOutcome>> {
    try {
      return { ok: true, value: classifyRecord(await this.source.loadTransaction(hash)) };
    } catch (error) {
      // Horizon serves its lookup from the history it has ingested, so a
      // transaction that has not reached a ledger yet is simply absent. That is
      // the expected state of every submission for its first few seconds.
      if (error instanceof NotFoundError) {
        return { ok: true, value: { status: "pending" } };
      }

      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /**
   * Decodes the envelope with the SDK's own primitive, against the passphrase the
   * signature committed to — so an envelope signed for another network cannot be
   * submitted here.
   *
   * A fee-bump envelope is refused for the same reason the XDR port refuses one:
   * the outer-fee indirection would let a different inner transaction travel
   * under a hash Vaqcrow never verified.
   */
  private decode(signedXdr: string): Transaction {
    const decoded = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);

    if (decoded instanceof FeeBumpTransaction) {
      throw new Error("A fee-bump envelope is not submittable");
    }

    return decoded;
  }
}

/**
 * One classifier for `tx_status`, applied to the resolved body *and* to the body
 * of a rejection.
 *
 * That single rule is not a shortcut: the SDK only converts a 400 into a
 * `TransactionFailedError`, so `DUPLICATE` (409) and `TRY_AGAIN_LATER` (503)
 * arrive as thrown errors whose body still carries the endpoint's `tx_status`.
 * Classifying on the field rather than on the transport is what keeps one
 * behaviour from needing two implementations.
 */
function classifyStatus(txStatus: string): StellarTransactionResult<StellarSubmissionOutcome> {
  switch (txStatus) {
    case "PENDING":
      // Accepted, not settled: core has it and a ledger may still decline it.
      return { ok: true, value: { status: "accepted" } };
    case "DUPLICATE":
      // The same envelope is already in flight, which is what a resuming poll
      // needs to hear: keep polling rather than treat it as an error.
      return { ok: true, value: { status: "accepted" } };
    case "ERROR":
      // Core refused it, and the async body carries the reason only as an
      // undecoded `error_result_xdr`, so no specific name is claimed here.
      return { ok: true, value: { status: "rejected", reason: "unsuccessful" } };
    case "TRY_AGAIN_LATER":
    default:
      // Transient, and an unrecognised status is treated the same way: guessing
      // "rejected" would mark an intent failed on a value the demo has never
      // seen, and the envelope's own maxTime bounds the retrying anyway.
      return { ok: false, error: { code: "unavailable" } };
  }
}

function classifySubmissionFailure(
  error: unknown
): StellarTransactionResult<StellarSubmissionOutcome> {
  // A `TransactionFailedError` is the one shape that carries a decoded result
  // code, so it is preferred over the generic status: it can say *why*, and the
  // status alone cannot.
  if (error instanceof TransactionFailedError) {
    return {
      ok: true,
      value: { status: "rejected", reason: reasonForResultCode(error.getResultCodes().transaction) }
    };
  }

  const txStatus = readTxStatus(error);

  return txStatus === undefined
    ? { ok: false, error: { code: "unavailable" } }
    : classifyStatus(txStatus);
}

/** Horizon's code, or the honest fallback when the demo has no name for it. */
function reasonForResultCode(code: string): StellarFailureReason {
  return RESULT_CODE_REASONS[code] ?? "unsuccessful";
}

/** Reads `response.data.tx_status` off a rejection without trusting its shape. */
function readTxStatus(error: unknown): string | undefined {
  const data = (error as { response?: { data?: unknown } } | null | undefined)?.response?.data;

  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const status = (data as { tx_status?: unknown }).tx_status;

  return typeof status === "string" ? status : undefined;
}

function classifyRecord(record: HorizonTransactionRecord): StellarTransactionOutcome {
  if (!record.successful) {
    // The transaction reached a ledger and the network refused it. Naming the
    // exact cause would mean decoding the operation-level result, which the
    // demo does not need: the state is terminal and the reason is honest.
    return { status: "failed", reason: "unsuccessful" };
  }

  return {
    status: "confirmed",
    // A ledger sequence is a uint64: it crosses this boundary as a string, never
    // as a number that could silently lose precision.
    ledgerSequence: String(record.ledger_attr),
    confirmedAt: record.created_at
  };
}

function horizonSource(config: StellarConfig): HorizonTransactionSource {
  const server = createHorizonServer(config);

  return {
    submitAsyncTransaction: (transaction) => server.submitAsyncTransaction(transaction),
    loadTransaction: (hash) => server.transactions().transaction(hash).call()
  };
}

import {
  Account,
  Asset,
  BadResponseError,
  Keypair,
  NetworkError,
  NotFoundError,
  Operation,
  TransactionBuilder,
  TransactionFailedError
} from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";
import { STELLAR_TESTNET_NETWORK_PASSPHRASE } from "../../application/config/stellar-config.js";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import { StellarTransaction } from "./stellar-transaction.js";
import type {
  HorizonSubmitAsyncResponse,
  HorizonTransactionRecord,
  HorizonTransactionSource
} from "./stellar-transaction.js";

/**
 * The adapter is driven entirely through its narrow `HorizonTransactionSource`,
 * so no Horizon server, no HTTP client and no network is ever constructed here.
 * The only real SDK work is building the signed envelope, because decoding it is
 * one of the behaviours under test.
 */

const CONFIG: StellarConfig = {
  network: "testnet",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE
};

const TRANSACTION_HASH = "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";
const LEDGER_SEQUENCE = 1234567;
const LEDGER_CLOSED_AT = "2026-09-21T12:00:05.000Z";

const sourceKeypair = Keypair.random();
const destinationKeypair = Keypair.random();

function signedEnvelope(): string {
  const account = new Account(sourceKeypair.publicKey(), "1099511627778");
  const transaction = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE
  })
    .addOperation(
      Operation.payment({
        destination: destinationKeypair.publicKey(),
        asset: Asset.native(),
        amount: "1"
      })
    )
    .setTimeout(60)
    .build();

  transaction.sign(sourceKeypair);
  return transaction.toXDR();
}

function record(overrides: Partial<HorizonTransactionRecord> = {}): HorizonTransactionRecord {
  return {
    hash: TRANSACTION_HASH,
    // `ledger_attr`, not `ledger`: see the note on the interface. The record's
    // `ledger` field is a link to the ledger resource, not the sequence.
    ledger_attr: LEDGER_SEQUENCE,
    successful: true,
    created_at: LEDGER_CLOSED_AT,
    ...overrides
  };
}

/** A `TransactionFailedError` shaped the way `toSubmissionError` builds it. */
function transactionFailed(code: string): TransactionFailedError {
  return new TransactionFailedError("Transaction submission failed", {
    data: { extras: { result_codes: { transaction: code } } },
    status: 400,
    statusText: "Bad Request"
  });
}

/** A non-400 rejection, whose body still carries the endpoint's `tx_status`. */
function badResponse(status: number, body: unknown): BadResponseError {
  return new BadResponseError("Transaction submission failed", {
    data: body,
    status,
    statusText: "Error"
  });
}

function sourceSubmitting(outcome: HorizonSubmitAsyncResponse | Error): {
  source: HorizonTransactionSource;
  submit: ReturnType<typeof vi.fn<HorizonTransactionSource["submitAsyncTransaction"]>>;
} {
  const submit = vi.fn<HorizonTransactionSource["submitAsyncTransaction"]>();

  if (outcome instanceof Error) {
    submit.mockRejectedValue(outcome);
  } else {
    submit.mockResolvedValue(outcome);
  }

  return { source: { submitAsyncTransaction: submit, loadTransaction: vi.fn() }, submit };
}

function sourceLoading(outcome: HorizonTransactionRecord | Error): {
  source: HorizonTransactionSource;
  load: ReturnType<typeof vi.fn<HorizonTransactionSource["loadTransaction"]>>;
} {
  const load = vi.fn<HorizonTransactionSource["loadTransaction"]>();

  if (outcome instanceof Error) {
    load.mockRejectedValue(outcome);
  } else {
    load.mockResolvedValue(outcome);
  }

  return { source: { submitAsyncTransaction: vi.fn(), loadTransaction: load }, load };
}

describe("StellarTransaction.submit", () => {
  it("decodes the envelope before handing it to the network", async () => {
    const { source, submit } = sourceSubmitting({ hash: TRANSACTION_HASH, tx_status: "PENDING" });

    await new StellarTransaction(CONFIG, source).submit(signedEnvelope());

    const handed = submit.mock.calls[0]?.[0] as Transaction;
    expect(handed.source).toBe(sourceKeypair.publicKey());
    // `hash()` is a byte array, not a Buffer: `toString("hex")` is silently
    // ignored on it, so the hex encoding has to be explicit.
    expect(Buffer.from(handed.hash()).toString("hex")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reports PENDING as accepted, never as confirmed", async () => {
    const { source } = sourceSubmitting({ hash: TRANSACTION_HASH, tx_status: "PENDING" });

    const result = await new StellarTransaction(CONFIG, source).submit(signedEnvelope());

    // The network has not decided yet. Claiming anything stronger here is the
    // settlement claim DEMO.md forbids.
    expect(result).toEqual({ ok: true, value: { status: "accepted" } });
  });

  it("reports DUPLICATE as accepted, because it means the envelope is already in flight", async () => {
    const { source } = sourceSubmitting({ hash: TRANSACTION_HASH, tx_status: "DUPLICATE" });

    const result = await new StellarTransaction(CONFIG, source).submit(signedEnvelope());

    expect(result).toEqual({ ok: true, value: { status: "accepted" } });
  });

  it("reports TRY_AGAIN_LATER as unavailable, which is the transient case", async () => {
    const { source } = sourceSubmitting({ hash: TRANSACTION_HASH, tx_status: "TRY_AGAIN_LATER" });

    const result = await new StellarTransaction(CONFIG, source).submit(signedEnvelope());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("reports an ERROR status as a rejection without a specific reason", async () => {
    const { source } = sourceSubmitting({ hash: TRANSACTION_HASH, tx_status: "ERROR" });

    const result = await new StellarTransaction(CONFIG, source).submit(signedEnvelope());

    expect(result).toEqual({ ok: true, value: { status: "rejected", reason: "unsuccessful" } });
  });

  it.each([
    ["tx_bad_seq", "bad_sequence"],
    ["tx_insufficient_fee", "insufficient_fee"],
    ["tx_insufficient_balance", "insufficient_balance"],
    ["tx_too_late", "expired"],
    ["tx_too_early", "too_early"],
    // A code the demo has no name for must still be reported, honestly and
    // without inventing precision.
    ["tx_bad_auth", "unsuccessful"],
    ["tx_failed", "unsuccessful"]
  ])("maps the result code %s to %s", async (code, reason) => {
    const { source } = sourceSubmitting(transactionFailed(code));

    const result = await new StellarTransaction(CONFIG, source).submit(signedEnvelope());

    expect(result).toEqual({ ok: true, value: { status: "rejected", reason } });
  });

  it("never puts Horizon's own result code on the wire", async () => {
    const { source } = sourceSubmitting(transactionFailed("tx_bad_seq"));

    const result = await new StellarTransaction(CONFIG, source).submit(signedEnvelope());

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.status !== "rejected") {
      throw new Error("expected a rejection");
    }
    expect(result.value.reason).not.toBe("tx_bad_seq");
    expect(JSON.stringify(result.value)).not.toContain("tx_");
  });

  it("reads a rejected submission whose tx_status arrives in the error body", async () => {
    // The SDK only turns a 400 into a `TransactionFailedError`; every other
    // non-2xx status rejects as a `BadResponseError` whose body still carries the
    // endpoint's `tx_status`. Classifying on that field means one rule covers
    // both shapes.
    const { source } = sourceSubmitting(badResponse(409, { tx_status: "DUPLICATE" }));

    const result = await new StellarTransaction(CONFIG, source).submit(signedEnvelope());

    expect(result).toEqual({ ok: true, value: { status: "accepted" } });
  });

  it("reads TRY_AGAIN_LATER out of an error body too", async () => {
    const { source } = sourceSubmitting(badResponse(503, { tx_status: "TRY_AGAIN_LATER" }));

    const result = await new StellarTransaction(CONFIG, source).submit(signedEnvelope());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a transport failure to unavailable, not to a rejection", async () => {
    const { source } = sourceSubmitting(new NetworkError("fetch failed", { status: undefined }));

    const result = await new StellarTransaction(CONFIG, source).submit(signedEnvelope());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it.each([
    ["a malformed envelope", "not-a-transaction"],
    ["an empty envelope", ""]
  ])("refuses %s without reaching the network", async (_description, xdr) => {
    const { source, submit } = sourceSubmitting({ hash: TRANSACTION_HASH, tx_status: "PENDING" });

    const result = await new StellarTransaction(CONFIG, source).submit(xdr);

    expect(result).toEqual({ ok: false, error: { code: "invalid_input" } });
    expect(submit).not.toHaveBeenCalled();
  });
});

describe("StellarTransaction.findTransaction", () => {
  it("reads an included transaction as confirmed, with Horizon's own evidence", async () => {
    const { source, load } = sourceLoading(record());

    const result = await new StellarTransaction(CONFIG, source).findTransaction(TRANSACTION_HASH);

    expect(result).toEqual({
      ok: true,
      value: {
        status: "confirmed",
        // A ledger sequence is a uint64: it crosses as a string, never a number.
        ledgerSequence: String(LEDGER_SEQUENCE),
        confirmedAt: LEDGER_CLOSED_AT
      }
    });
    expect(load).toHaveBeenCalledWith(TRANSACTION_HASH);
  });

  it("reads a transaction that reached a ledger but failed as failed", async () => {
    const { source } = sourceLoading(record({ successful: false }));

    const result = await new StellarTransaction(CONFIG, source).findTransaction(TRANSACTION_HASH);

    expect(result).toEqual({ ok: true, value: { status: "failed", reason: "unsuccessful" } });
  });

  it("reads a transaction Horizon has not ingested as pending, not as an error", async () => {
    const { source } = sourceLoading(
      new NotFoundError("Not Found", { status: 404, statusText: "Not Found" })
    );

    const result = await new StellarTransaction(CONFIG, source).findTransaction(TRANSACTION_HASH);

    // Every submission looks like this for its first few seconds. It is an
    // outcome, not a failure to retry — the envelope's own maxTime is the bound.
    expect(result).toEqual({ ok: true, value: { status: "pending" } });
  });

  it("maps a transport failure to unavailable", async () => {
    const { source } = sourceLoading(new NetworkError("fetch failed", { status: undefined }));

    const result = await new StellarTransaction(CONFIG, source).findTransaction(TRANSACTION_HASH);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("never leaks the provider's error message or response body", async () => {
    const { source } = sourceLoading(
      new BadResponseError("Horizon said something internal", {
        data: { title: "Internal Server Error", detail: "a stack trace" },
        status: 500,
        statusText: "Internal Server Error"
      })
    );

    const result = await new StellarTransaction(CONFIG, source).findTransaction(TRANSACTION_HASH);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(Object.keys(result.error)).toEqual(["code"]);
    expect(JSON.stringify(result.error)).not.toContain("stack trace");
  });
});

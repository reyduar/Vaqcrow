import {
  Account,
  Asset,
  BASE_FEE,
  FeeBumpTransaction,
  Keypair,
  Memo,
  Operation,
  TransactionBuilder
} from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";
import type {
  BuildFundingIntentXdrInput,
  BuiltFundingIntentXdr,
  FundingIntentXdrPort,
  FundingIntentXdrResult,
  VerifiedFundingIntentXdr,
  VerifyFundingIntentXdrInput
} from "../../application/ports/funding-intent-xdr-port.js";
import { stroopsToXlm, xlmToStroops } from "./stellar-amounts.js";

/**
 * Encode and verify funding-intent transactions with the Stellar SDK.
 *
 * The adapter is the only place the SDK touches this flow. It builds a single
 * native payment with explicit time bounds, and on the way back it re-derives
 * every fact from the envelope rather than trusting the caller: source,
 * sequence, destination, asset, amount, memo, time bounds, operation allowlist
 * and a signature that verifies against the expected source public key.
 *
 * The network passphrase is passed in on every call. It is never defaulted
 * here, because the API — not the adapter — owns which network an intent
 * belongs to (`#14` closed configuration to Testnet; this adapter inherits that
 * rather than re-deciding it).
 *
 * Nothing in this file signs on behalf of a user. `Keypair.fromPublicKey` only
 * ever verifies; no method can produce a signature, and no secret key is read.
 */

/**
 * Upper bound used when the caller does not supply one. A funding intent is a
 * short-lived instruction to move money, so it must expire: fifteen minutes is
 * long enough for a wallet prompt and short enough that a leaked signed
 * envelope is useless quickly.
 */
const DEFAULT_MAX_TIME_SECONDS = 15 * 60;

export class StellarFundingIntentXdr implements FundingIntentXdrPort {
  build(input: BuildFundingIntentXdrInput): FundingIntentXdrResult<BuiltFundingIntentXdr> {
    const now = nowSeconds();
    const maxTime = input.maxTimeUnixSeconds ?? now + DEFAULT_MAX_TIME_SECONDS;

    if (maxTime <= now) {
      // Building an already-expired envelope would hand the signer a
      // transaction that can never be submitted; that is a caller error.
      return { ok: false, error: { code: "invalid_input", reason: "maxTimeUnixSeconds" } };
    }

    try {
      const transaction = new TransactionBuilder(
        new Account(input.sourceAccountId, input.sourceSequence),
        {
          fee: BASE_FEE,
          networkPassphrase: input.networkPassphrase,
          memo: input.memo === undefined ? Memo.none() : Memo.text(input.memo),
          timebounds: { minTime: String(now), maxTime: String(maxTime) }
        }
      )
        .addOperation(
          Operation.payment({
            destination: input.destinationAccountId,
            asset: Asset.native(),
            amount: stroopsToXlm(input.amountStroops)
          })
        )
        .build();

      return {
        ok: true,
        value: {
          xdr: transaction.toXdr(),
          networkPassphrase: input.networkPassphrase,
          sourceAccountId: input.sourceAccountId,
          // The effective sequence encoded in the envelope: the SDK increments
          // the account sequence when building, so this — not the raw input — is
          // what a later `verify` must compare against.
          sourceSequence: transaction.sequence,
          destinationAccountId: input.destinationAccountId,
          amountStroops: input.amountStroops,
          expiresAt: new Date(maxTime * 1000).toISOString(),
          ...(input.memo === undefined ? {} : { memo: input.memo })
        }
      };
    } catch {
      // A malformed public key, a uint64-invalid sequence or an over-long memo
      // all land here. The port promises no exception reaches the use case.
      return { ok: false, error: { code: "invalid_input" } };
    }
  }

  verify(input: VerifyFundingIntentXdrInput): FundingIntentXdrResult<VerifiedFundingIntentXdr> {
    let transaction: Transaction | FeeBumpTransaction;

    try {
      transaction = TransactionBuilder.fromXDR(input.xdr, input.networkPassphrase);
    } catch {
      return { ok: false, error: { code: "malformed_xdr", reason: "envelope" } };
    }

    // D8: `fromXDR` may return a fee-bump wrapper. Refusing it keeps the
    // outer-fee indirection from carrying a different inner transaction past
    // the allowlist below.
    if (transaction instanceof FeeBumpTransaction) {
      return { ok: false, error: { code: "fee_bump", reason: "envelope" } };
    }

    try {
      return this.verifyDecoded(transaction, input);
    } catch {
      // Belt and braces for the port's never-throw contract: every branch above
      // is handled explicitly, so reaching here means the SDK rejected an
      // otherwise well-formed envelope.
      return { ok: false, error: { code: "malformed_xdr", reason: "envelope" } };
    }
  }

  private verifyDecoded(
    transaction: Transaction,
    input: VerifyFundingIntentXdrInput
  ): FundingIntentXdrResult<VerifiedFundingIntentXdr> {
    const operations = transaction.operations;

    // Allowlist, not a blocklist: a funding intent is exactly one native
    // payment. Arbitrary operations cannot ride along inside it.
    if (operations.length !== 1) {
      return unsupportedOperation("operation_count");
    }

    const operation = operations[0];

    if (operation === undefined || operation.type !== "payment") {
      return unsupportedOperation("operation_type");
    }

    if (transaction.source !== input.sourceAccountId) {
      return mismatch("source");
    }

    if (transaction.sequence !== input.sourceSequence) {
      return mismatch("sequence");
    }

    if (operation.destination !== input.destinationAccountId) {
      return mismatch("destination");
    }

    if (!operation.asset.equals(Asset.native())) {
      return mismatch("asset");
    }

    const decodedStroops = toStroopsOrNull(operation.amount);

    if (decodedStroops === null || decodedStroops !== input.amountStroops) {
      return mismatch("amount");
    }

    if (!memoMatches(transaction.memo, input.memo)) {
      return mismatch("memo");
    }

    const bounds = transaction.timeBounds;

    if (bounds === undefined || bounds.maxTime === "0") {
      // The intent was persisted with an expiry; an envelope that never expires
      // cannot be the envelope that intent described.
      return mismatch("timebounds");
    }

    const expectedMaxTime = parseUnixSeconds(input.expiresAt);

    if (expectedMaxTime === null) {
      return { ok: false, error: { code: "invalid_input", reason: "expiresAt" } };
    }

    if (bounds.maxTime !== String(expectedMaxTime)) {
      return mismatch("timebounds");
    }

    const now = BigInt(nowSeconds());

    if (BigInt(bounds.maxTime) <= now || BigInt(bounds.minTime) > now) {
      return { ok: false, error: { code: "expired", reason: "timebounds" } };
    }

    const signer = toKeypairOrNull(input.sourceAccountId);

    if (signer === null) {
      return { ok: false, error: { code: "invalid_input", reason: "sourceAccountId" } };
    }

    // The signature is verified against the expected source public key, so only
    // the account owner's signature passes. A signature produced for another
    // network fails here because the passphrase is what `hash()` is derived
    // from — the check is cryptographic, so no passphrase comparison is needed.
    const hash = transaction.hash();
    const signed = transaction.signatures.some((signature) => signer.verify(hash, signature.signature));

    if (!signed) {
      return {
        ok: false,
        error: {
          code: "invalid_signature",
          reason: transaction.signatures.length === 0 ? "missing" : "signature"
        }
      };
    }

    return {
      ok: true,
      value: {
        transactionHash: Buffer.from(hash).toString("hex"),
        sourceAccountId: transaction.source,
        destinationAccountId: operation.destination,
        amountStroops: decodedStroops,
        expiresAt: input.expiresAt,
        ...(input.memo === undefined ? {} : { memo: input.memo })
      }
    };
  }
}

function mismatch(reason: string): FundingIntentXdrResult<never> {
  return { ok: false, error: { code: "intent_mismatch", reason } };
}

function unsupportedOperation(reason: string): FundingIntentXdrResult<never> {
  return { ok: false, error: { code: "unsupported_operation", reason } };
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function parseUnixSeconds(timestamp: string): number | null {
  const milliseconds = Date.parse(timestamp);

  return Number.isNaN(milliseconds) ? null : Math.floor(milliseconds / 1000);
}

/** `null` rather than a throw: a decoded amount that cannot parse is a mismatch. */
function toStroopsOrNull(amount: string): bigint | null {
  try {
    return xlmToStroops(amount);
  } catch {
    return null;
  }
}

function toKeypairOrNull(accountId: string): Keypair | null {
  try {
    return Keypair.fromPublicKey(accountId);
  } catch {
    return null;
  }
}

/**
 * An expected memo is matched by type and value: an intent that asked for no
 * memo must not accept one, and `id`/`hash` memos are not interchangeable with
 * the text the intent declared.
 */
function memoMatches(memo: Memo, expected: string | undefined): boolean {
  if (expected === undefined) {
    return memo.type === "none";
  }

  if (memo.type !== "text") {
    return false;
  }

  const value = memo.value;

  if (value === null) {
    return false;
  }

  return (typeof value === "string" ? value : new TextDecoder().decode(value)) === expected;
}

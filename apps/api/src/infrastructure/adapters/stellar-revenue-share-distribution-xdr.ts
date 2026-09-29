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
import type { DistributionRecipient } from "@vaqcrow/contracts";
import type {
  BuildRevenueShareDistributionXdrInput,
  BuiltRevenueShareDistributionXdr,
  RevenueShareDistributionXdrPort,
  RevenueShareDistributionXdrResult,
  VerifiedRevenueShareDistributionXdr,
  VerifyRevenueShareDistributionXdrInput
} from "../../application/ports/revenue-share-distribution-xdr-port.js";
import { stroopsToXlm, xlmToStroops } from "./stellar-amounts.js";

/**
 * Encode and verify revenue-share distribution transactions with the Stellar SDK.
 *
 * The adapter is the only place the SDK touches this flow. It builds one native
 * payment per declared recipient — a single classic transaction (`D2`) — with
 * explicit time bounds, and on the way back it re-derives every fact from the
 * envelope rather than trusting the caller: source, sequence, each recipient's
 * destination and amount in order, asset, memo, time bounds, operation
 * allowlist and a signature that verifies against the expected source public
 * key.
 *
 * The network passphrase is taken from the declared terms on every call and is
 * never defaulted here, because the API — not the adapter — owns which network a
 * distribution belongs to. The declared `network` label is never compared: it is
 * a human name, while the passphrase is what a signature commits to.
 *
 * Nothing in this file signs on behalf of a user. `Keypair.fromPublicKey` only
 * ever verifies; no method can produce a signature, and no secret key is read.
 */
export class StellarRevenueShareDistributionXdr implements RevenueShareDistributionXdrPort {
  build(
    input: BuildRevenueShareDistributionXdrInput
  ): RevenueShareDistributionXdrResult<BuiltRevenueShareDistributionXdr> {
    const { terms } = input;

    if (terms.recipients.length === 0) {
      // A distribution that pays nobody is not expressible; the S1 contract
      // already requires at least one recipient, and the port defends the
      // boundary rather than trusting it.
      return { ok: false, error: { code: "invalid_input", reason: "recipients" } };
    }

    const now = nowSeconds();
    const declaredMaxTime = parseUnixSeconds(terms.expiresAt);
    const maxTime = input.maxTimeUnixSeconds ?? declaredMaxTime;

    if (maxTime === null) {
      return { ok: false, error: { code: "invalid_input", reason: "expiresAt" } };
    }

    if (maxTime <= now) {
      // Building an already-expired envelope would hand the signer a transaction
      // that can never be submitted; that is a caller error.
      return {
        ok: false,
        error: {
          code: "invalid_input",
          reason: input.maxTimeUnixSeconds === undefined ? "expiresAt" : "maxTimeUnixSeconds"
        }
      };
    }

    try {
      const builder = new TransactionBuilder(
        new Account(terms.sourceAccountId, terms.sourceSequence),
        {
          fee: BASE_FEE,
          networkPassphrase: terms.networkPassphrase,
          memo: terms.memo === null ? Memo.none() : Memo.text(terms.memo),
          timebounds: { minTime: String(now), maxTime: String(maxTime) }
        }
      );

      // Exactly one native payment per recipient, added in the declared order
      // (`D2`). The order is part of what the envelope commits to, so it is
      // preserved verbatim rather than sorted.
      for (const recipient of terms.recipients) {
        builder.addOperation(
          Operation.payment({
            destination: recipient.accountId,
            asset: Asset.native(),
            amount: stroopsToXlm(recipient.amountStroops)
          })
        );
      }

      const transaction = builder.build();

      return {
        ok: true,
        value: {
          xdr: transaction.toXdr(),
          networkPassphrase: terms.networkPassphrase,
          sourceAccountId: terms.sourceAccountId,
          // The effective sequence encoded in the envelope: the SDK increments
          // the account sequence when building, so this — not the raw input — is
          // what a later `verify` must compare against.
          sourceSequence: transaction.sequence,
          recipients: terms.recipients,
          memo: terms.memo,
          expiresAt: new Date(maxTime * 1000).toISOString()
        }
      };
    } catch {
      // A malformed public key, a uint64-invalid sequence, an over-long memo or
      // an out-of-range amount all land here. The port promises no exception
      // reaches the use case.
      return { ok: false, error: { code: "invalid_input" } };
    }
  }

  verify(
    input: VerifyRevenueShareDistributionXdrInput
  ): RevenueShareDistributionXdrResult<VerifiedRevenueShareDistributionXdr> {
    let transaction: Transaction | FeeBumpTransaction;

    try {
      transaction = TransactionBuilder.fromXDR(input.xdr, input.terms.networkPassphrase);
    } catch {
      return { ok: false, error: { code: "malformed_xdr", reason: "envelope" } };
    }

    // `fromXDR` may return a fee-bump wrapper. Refusing it keeps the outer-fee
    // indirection from carrying a different inner transaction past the
    // recipient allowlist below.
    if (transaction instanceof FeeBumpTransaction) {
      return { ok: false, error: { code: "fee_bump", reason: "envelope" } };
    }

    try {
      return this.verifyDecoded(transaction, input.terms);
    } catch {
      // Belt and braces for the port's never-throw contract: every branch above
      // is handled explicitly, so reaching here means the SDK rejected an
      // otherwise well-formed envelope.
      return { ok: false, error: { code: "malformed_xdr", reason: "envelope" } };
    }
  }

  private verifyDecoded(
    transaction: Transaction,
    terms: VerifyRevenueShareDistributionXdrInput["terms"]
  ): RevenueShareDistributionXdrResult<VerifiedRevenueShareDistributionXdr> {
    if (terms.recipients.length === 0) {
      return { ok: false, error: { code: "invalid_input", reason: "recipients" } };
    }

    const operations = transaction.operations;

    // Allowlist, not a blocklist: a distribution is exactly one native payment
    // per declared recipient. Arbitrary operations cannot ride along inside it.
    if (operations.length !== terms.recipients.length) {
      return unsupportedOperation("operation_count");
    }

    if (transaction.source !== terms.sourceAccountId) {
      return mismatch("source");
    }

    if (transaction.sequence !== terms.sourceSequence) {
      return mismatch("sequence");
    }

    const recovered = recoverRecipients(operations, terms.recipients);

    if (!recovered.ok) {
      return recovered;
    }

    if (!memoMatches(transaction.memo, terms.memo)) {
      return mismatch("memo");
    }

    const bounds = transaction.timeBounds;

    if (bounds === undefined || bounds.maxTime === "0") {
      // The terms were declared with an expiry; an envelope that never expires
      // cannot be the envelope those terms described.
      return mismatch("timebounds");
    }

    const expectedMaxTime = parseUnixSeconds(terms.expiresAt);

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

    const signer = toKeypairOrNull(terms.sourceAccountId);

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
        recipients: recovered.value,
        memo: memoToDeclared(transaction.memo),
        expiresAt: new Date(Number(bounds.maxTime) * 1000).toISOString()
      }
    };
  }
}

/**
 * Walks the operations and the declared recipients in lockstep, recovering the
 * `(accountId, amountStroops)` each payment encodes. Any deviation from the
 * declared recipient at the same index is a mismatch: a different destination,
 * a different amount, or a different order are the same failure — the envelope
 * does not say what the caller declared it would.
 */
function recoverRecipients(
  operations: readonly Transaction["operations"][number][],
  declared: VerifyRevenueShareDistributionXdrInput["terms"]["recipients"]
): RevenueShareDistributionXdrResult<VerifiedRevenueShareDistributionXdr["recipients"]> {
  const recipients: DistributionRecipient[] = [];

  for (const [index, operation] of operations.entries()) {
    if (operation === undefined || operation.type !== "payment") {
      return unsupportedOperation("operation_type");
    }

    if (!operation.asset.equals(Asset.native())) {
      return mismatch("asset");
    }

    const declaredRecipient = declared[index];

    if (declaredRecipient === undefined || operation.destination !== declaredRecipient.accountId) {
      return mismatch("recipients");
    }

    const decodedStroops = toStroopsOrNull(operation.amount);

    if (decodedStroops === null || decodedStroops !== declaredRecipient.amountStroops) {
      return mismatch("recipients");
    }

    recipients.push({ accountId: operation.destination, amountStroops: decodedStroops });
  }

  return { ok: true, value: recipients };
}

function mismatch(reason: string): RevenueShareDistributionXdrResult<never> {
  return { ok: false, error: { code: "intent_mismatch", reason } };
}

function unsupportedOperation(reason: string): RevenueShareDistributionXdrResult<never> {
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
 * An expected memo is matched by type and value: terms that declared no memo
 * must not accept one, and `id`/`hash` memos are not interchangeable with the
 * text the terms declared. `null` is the declared absence of a memo.
 */
function memoMatches(memo: Memo, expected: string | null): boolean {
  if (expected === null) {
    return memo.type === "none";
  }

  if (memo.type !== "text") {
    return false;
  }

  const value = memo.value;

  if (value === null) {
    return false;
  }

  return decodeMemoValue(value) === expected;
}

/** The declared form of a decoded memo: `null` when the envelope carries none. */
function memoToDeclared(memo: Memo): string | null {
  if (memo.type !== "text") {
    return null;
  }

  const value = memo.value;

  if (value === null) {
    return null;
  }

  return decodeMemoValue(value);
}

function decodeMemoValue(value: string | Uint8Array): string {
  return typeof value === "string" ? value : new TextDecoder().decode(value);
}

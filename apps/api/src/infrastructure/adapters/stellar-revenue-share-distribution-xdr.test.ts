import {
  Account,
  Asset,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TimeoutInfinite,
  TransactionBuilder
} from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";
import type { DistributionRecipient, RevenueShareDistributionTerms } from "@vaqcrow/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BuildRevenueShareDistributionXdrInput,
  BuiltRevenueShareDistributionXdr,
  VerifyRevenueShareDistributionXdrInput
} from "../../application/ports/revenue-share-distribution-xdr-port.js";
import { StellarRevenueShareDistributionXdr } from "./stellar-revenue-share-distribution-xdr.js";

/**
 * Every test runs offline: keypairs are generated locally, the account is a
 * local `Account`, and no Horizon or RPC client is ever constructed. A signature
 * is a pure function of a key and a transaction hash, so the whole build/verify
 * surface is exercised without a network.
 */

const NETWORK_PASSPHRASE = Networks.TESTNET;
/** A passphrase that is deliberately not the one the transactions are built for. */
const OTHER_NETWORK_PASSPHRASE = "Vaqcrow Distribution Test Network ; September 2026";

/** Frozen wall clock. Time bounds and `expiresAt` are only meaningful against a fixed now. */
const NOW_SECONDS = 1_800_000_000;
const MAX_TIME = NOW_SECONDS + 900;
const EXPIRES_AT = new Date(MAX_TIME * 1000).toISOString();

/** The account sequence the caller supplies to `build`. */
const SOURCE_SEQUENCE = "123456789";
/** The effective sequence the builder encodes, which `verify` expects. */
const EFFECTIVE_SEQUENCE = "123456790";

const sourceKeypair = Keypair.random();
const firstRecipientKeypair = Keypair.random();
const secondRecipientKeypair = Keypair.random();
const otherKeypair = Keypair.random();

const FIRST_RECIPIENT: DistributionRecipient = {
  accountId: firstRecipientKeypair.publicKey(),
  amountStroops: 10_0000000n
};
const SECOND_RECIPIENT: DistributionRecipient = {
  accountId: secondRecipientKeypair.publicKey(),
  amountStroops: 2_5000000n
};
const RECIPIENTS: DistributionRecipient[] = [FIRST_RECIPIENT, SECOND_RECIPIENT];

const port = new StellarRevenueShareDistributionXdr();

function copyRecipients(recipients: readonly DistributionRecipient[] = RECIPIENTS): DistributionRecipient[] {
  return recipients.map((recipient) => ({ ...recipient }));
}

function terms(overrides: Partial<RevenueShareDistributionTerms> = {}): RevenueShareDistributionTerms {
  return {
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASE,
    sourceAccountId: sourceKeypair.publicKey(),
    sourceSequence: SOURCE_SEQUENCE,
    memo: null,
    expiresAt: EXPIRES_AT,
    recipients: copyRecipients(),
    ...overrides
  };
}

function buildInput(
  overrides: Partial<RevenueShareDistributionTerms> = {},
  maxTimeUnixSeconds?: number
): BuildRevenueShareDistributionXdrInput {
  return {
    terms: terms(overrides),
    ...(maxTimeUnixSeconds === undefined ? {} : { maxTimeUnixSeconds })
  };
}

function expectBuilt(input: BuildRevenueShareDistributionXdrInput): BuiltRevenueShareDistributionXdr {
  const result = port.build(input);

  if (!result.ok) {
    throw new Error(`expected build to succeed, got ${result.error.code}`);
  }

  return result.value;
}

function verifyTerms(overrides: Partial<RevenueShareDistributionTerms> = {}): RevenueShareDistributionTerms {
  return terms({ sourceSequence: EFFECTIVE_SEQUENCE, ...overrides });
}

function verifyInput(
  xdr: string,
  overrides: Partial<RevenueShareDistributionTerms> = {}
): VerifyRevenueShareDistributionXdrInput {
  return { xdr, terms: verifyTerms(overrides) };
}

/** Decodes the adapter's own unsigned XDR, signs it with `signer`, and re-serialises. */
function signedEnvelope(
  target: RevenueShareDistributionTerms = terms(),
  signer: Keypair = sourceKeypair
): string {
  const built = expectBuilt({ terms: target });
  const transaction = TransactionBuilder.fromXDR(built.xdr, target.networkPassphrase) as Transaction;
  transaction.sign(signer);
  return transaction.toXdr();
}

/** A signature bound to one transaction's hash, for attaching to a different one. */
function signatureOver(
  target: RevenueShareDistributionTerms = terms(),
  signer: Keypair = sourceKeypair
): ReturnType<Keypair["signDecorated"]> {
  const built = expectBuilt({ terms: target });
  const transaction = TransactionBuilder.fromXDR(built.xdr, target.networkPassphrase) as Transaction;
  return signer.signDecorated(transaction.hash());
}

/** Builds for `target`, then grafts a signature made over a different hash onto it. */
function tamperedEnvelope(
  target: RevenueShareDistributionTerms,
  foreignSignature: ReturnType<Keypair["signDecorated"]>
): string {
  const built = expectBuilt({ terms: target });
  const transaction = TransactionBuilder.fromXDR(built.xdr, target.networkPassphrase) as Transaction;
  transaction.addDecoratedSignature(foreignSignature);
  return transaction.toXdr();
}

function timeBounds(): { minTime: string; maxTime: string } {
  return { minTime: String(NOW_SECONDS), maxTime: String(MAX_TIME) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_SECONDS * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("StellarRevenueShareDistributionXdr.build", () => {
  it("builds exactly one native payment per recipient, in the declared order", () => {
    const built = expectBuilt(buildInput());
    const transaction = TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE) as Transaction;
    const [first, second] = transaction.operations;

    if (first === undefined || first.type !== "payment" || second === undefined || second.type !== "payment") {
      throw new Error("expected exactly two payment operations");
    }

    expect(transaction.source).toBe(sourceKeypair.publicKey());
    expect(transaction.sequence).toBe(EFFECTIVE_SEQUENCE);
    expect(transaction.networkPassphrase).toBe(NETWORK_PASSPHRASE);
    expect(transaction.signatures).toHaveLength(0);
    expect(transaction.operations).toHaveLength(2);

    expect(first.destination).toBe(firstRecipientKeypair.publicKey());
    expect(first.amount).toBe("10.0000000");
    expect(first.asset.equals(Asset.native())).toBe(true);

    expect(second.destination).toBe(secondRecipientKeypair.publicKey());
    expect(second.amount).toBe("2.5000000");
    expect(second.asset.equals(Asset.native())).toBe(true);

    expect(transaction.memo.type).toBe("none");
  });

  it("echoes the fields the caller has to persist", () => {
    const declared = terms();
    const built = expectBuilt({ terms: declared });

    expect(built).toMatchObject({
      networkPassphrase: NETWORK_PASSPHRASE,
      sourceAccountId: sourceKeypair.publicKey(),
      sourceSequence: EFFECTIVE_SEQUENCE,
      memo: null,
      expiresAt: EXPIRES_AT
    });
    expect(built.recipients).toEqual(declared.recipients);
  });

  it("sets explicit time bounds and derives expiresAt from them", () => {
    const built = expectBuilt(buildInput());
    const transaction = TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE) as Transaction;
    const bounds = transaction.timeBounds;

    if (bounds === undefined) {
      throw new Error("expected time bounds to be set");
    }

    expect(bounds.minTime).toBe(String(NOW_SECONDS));
    expect(bounds.maxTime).toBe(String(MAX_TIME));
    expect(new Date(built.expiresAt).getTime()).toBe(Number(bounds.maxTime) * 1000);
  });

  it("honours an explicit upper bound over the declared expiry", () => {
    const explicitMaxTime = NOW_SECONDS + 300;
    const built = expectBuilt(buildInput({}, explicitMaxTime));
    const transaction = TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE) as Transaction;

    expect(transaction.timeBounds?.maxTime).toBe(String(explicitMaxTime));
    expect(built.expiresAt).toBe(new Date(explicitMaxTime * 1000).toISOString());
  });

  it("attaches a text memo when one is requested", () => {
    const built = expectBuilt(buildInput({ memo: "distribution-alpha" }));
    const transaction = TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE) as Transaction;

    expect(transaction.memo.type).toBe("text");
    expect(new TextDecoder().decode(transaction.memo.value as Uint8Array)).toBe("distribution-alpha");
  });

  it("returns invalid_input for an empty recipient list", () => {
    const result = port.build({ terms: terms({ recipients: [] }) });

    expect(result).toEqual({ ok: false, error: { code: "invalid_input", reason: "recipients" } });
  });

  it("returns invalid_input instead of throwing on an unbuildable terms", () => {
    // A text memo is capped at 28 bytes by the protocol; asking for more must be
    // a caller error, not an exception escaping the port.
    const result = port.build({ terms: terms({ memo: "x".repeat(29) }) });

    expect(result).toEqual({ ok: false, error: { code: "invalid_input" } });
  });

  it("refuses a declared expiry that has already passed", () => {
    const result = port.build({ terms: terms({ expiresAt: new Date(NOW_SECONDS * 1000).toISOString() }) });

    expect(result).toEqual({ ok: false, error: { code: "invalid_input", reason: "expiresAt" } });
  });

  it("refuses an explicit upper bound that has already passed", () => {
    const result = port.build(buildInput({}, NOW_SECONDS));

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_input", reason: "maxTimeUnixSeconds" }
    });
  });
});

describe("StellarRevenueShareDistributionXdr.verify", () => {
  it("accepts a correctly signed multi-payment envelope and recovers each recipient", () => {
    const signed = signedEnvelope(terms());
    const decoded = TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE) as Transaction;

    const result = port.verify(verifyInput(signed));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.value.transactionHash).toBe(Buffer.from(decoded.hash()).toString("hex"));
    expect(result.value.sourceAccountId).toBe(sourceKeypair.publicKey());
    expect(result.value.recipients).toEqual([
      { accountId: firstRecipientKeypair.publicKey(), amountStroops: 10_0000000n },
      { accountId: secondRecipientKeypair.publicKey(), amountStroops: 2_5000000n }
    ]);
    expect(result.value.memo).toBeNull();
    expect(result.value.expiresAt).toBe(EXPIRES_AT);
  });

  it("accepts an envelope whose memo matches the declared one", () => {
    const signed = signedEnvelope(terms({ memo: "distribution-alpha" }));

    const result = port.verify(verifyInput(signed, { memo: "distribution-alpha" }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.value.memo).toBe("distribution-alpha");
  });

  it("rejects malformed XDR", () => {
    expect(port.verify(verifyInput("not-a-transaction"))).toEqual({
      ok: false,
      error: { code: "malformed_xdr", reason: "envelope" }
    });
  });

  it("rejects a fee-bump envelope", () => {
    // The outer fee payer must not be able to wrap a different inner transaction
    // past the recipient allowlist.
    const inner = TransactionBuilder.fromXDR(expectBuilt({ terms: terms() }).xdr, NETWORK_PASSPHRASE) as Transaction;
    inner.sign(sourceKeypair);
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      otherKeypair,
      BASE_FEE,
      inner,
      NETWORK_PASSPHRASE
    );

    expect(port.verify(verifyInput(feeBump.toXdr()))).toEqual({
      ok: false,
      error: { code: "fee_bump", reason: "envelope" }
    });
  });

  it("rejects an operation that is not a payment", () => {
    const transaction = new TransactionBuilder(
      new Account(sourceKeypair.publicKey(), SOURCE_SEQUENCE),
      { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE, timebounds: timeBounds() }
    )
      .addOperation(Operation.manageData({ name: "distribution", value: "alpha" }))
      .build();
    transaction.sign(sourceKeypair);

    expect(port.verify(verifyInput(transaction.toXdr(), { recipients: [FIRST_RECIPIENT] }))).toEqual({
      ok: false,
      error: { code: "unsupported_operation", reason: "operation_type" }
    });
  });

  it("rejects an operation count that differs from the declared recipients", () => {
    const signed = signedEnvelope(terms({ recipients: [FIRST_RECIPIENT] }));

    expect(port.verify(verifyInput(signed, { recipients: copyRecipients() }))).toEqual({
      ok: false,
      error: { code: "unsupported_operation", reason: "operation_count" }
    });
  });

  it("rejects an envelope with no signature", () => {
    const built = expectBuilt({ terms: terms() });

    expect(port.verify(verifyInput(built.xdr))).toEqual({
      ok: false,
      error: { code: "invalid_signature", reason: "missing" }
    });
  });

  it("rejects a signature that did not come from the expected source", () => {
    const signed = signedEnvelope(terms(), otherKeypair);

    expect(port.verify(verifyInput(signed))).toEqual({
      ok: false,
      error: { code: "invalid_signature", reason: "signature" }
    });
  });

  it("rejects a valid signature produced for another network", () => {
    // The passphrase is what the signature hash is derived from, so a Testnet
    // signature does not verify once the envelope is judged against another
    // network. The check is cryptographic; no passphrase string comparison is
    // involved.
    const built = expectBuilt({ terms: terms() });
    const transaction = TransactionBuilder.fromXDR(built.xdr, OTHER_NETWORK_PASSPHRASE) as Transaction;
    transaction.sign(sourceKeypair);

    expect(port.verify(verifyInput(transaction.toXdr()))).toEqual({
      ok: false,
      error: { code: "invalid_signature", reason: "signature" }
    });
  });

  it("rejects a source that differs from the declared one", () => {
    const signed = signedEnvelope(terms());

    expect(port.verify(verifyInput(signed, { sourceAccountId: otherKeypair.publicKey() }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "source" }
    });
  });

  it("rejects a sequence that differs from the declared one", () => {
    const signed = signedEnvelope(terms());

    expect(port.verify(verifyInput(signed, { sourceSequence: "123456792" }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "sequence" }
    });
  });

  it("rejects a payment to a different destination", () => {
    const signed = signedEnvelope(terms());
    const altered: DistributionRecipient[] = [
      FIRST_RECIPIENT,
      { accountId: otherKeypair.publicKey(), amountStroops: SECOND_RECIPIENT.amountStroops }
    ];

    expect(port.verify(verifyInput(signed, { recipients: altered }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "recipients" }
    });
  });

  it("rejects an amount that differs from the declared one", () => {
    const signed = signedEnvelope(terms());
    const altered: DistributionRecipient[] = [
      { ...FIRST_RECIPIENT, amountStroops: FIRST_RECIPIENT.amountStroops + 1n },
      SECOND_RECIPIENT
    ];

    expect(port.verify(verifyInput(signed, { recipients: altered }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "recipients" }
    });
  });

  it("rejects a recipient order that differs from the declared one", () => {
    const signed = signedEnvelope(terms());

    expect(port.verify(verifyInput(signed, { recipients: [SECOND_RECIPIENT, FIRST_RECIPIENT] }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "recipients" }
    });
  });

  it("rejects an asset that is not the native asset", () => {
    const creditAsset = new Asset("USDC", otherKeypair.publicKey());
    const transaction = new TransactionBuilder(
      new Account(sourceKeypair.publicKey(), SOURCE_SEQUENCE),
      { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE, timebounds: timeBounds() }
    )
      .addOperation(
        Operation.payment({
          destination: FIRST_RECIPIENT.accountId,
          asset: creditAsset,
          amount: "10.0000000"
        })
      )
      .build();
    transaction.sign(sourceKeypair);

    expect(port.verify(verifyInput(transaction.toXdr(), { recipients: [FIRST_RECIPIENT] }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "asset" }
    });
  });

  it("rejects a memo that differs from the declared one", () => {
    const signed = signedEnvelope(terms({ memo: "distribution-alpha" }));

    expect(port.verify(verifyInput(signed, { memo: "distribution-beta" }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "memo" }
    });
    expect(port.verify(verifyInput(signed))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "memo" }
    });
  });

  it("rejects an envelope whose time bounds do not match the declared expiry", () => {
    const signed = signedEnvelope(terms());

    // The expiry is a minute later than the signed envelope's upper bound.
    expect(
      port.verify(verifyInput(signed, { expiresAt: new Date((MAX_TIME + 60) * 1000).toISOString() }))
    ).toEqual({ ok: false, error: { code: "intent_mismatch", reason: "timebounds" } });
  });

  it("rejects an envelope with unbounded time bounds", () => {
    const transaction = new TransactionBuilder(
      new Account(sourceKeypair.publicKey(), SOURCE_SEQUENCE),
      { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }
    )
      .addOperation(
        Operation.payment({
          destination: FIRST_RECIPIENT.accountId,
          asset: Asset.native(),
          amount: "10.0000000"
        })
      )
      .addOperation(
        Operation.payment({
          destination: SECOND_RECIPIENT.accountId,
          asset: Asset.native(),
          amount: "2.5000000"
        })
      )
      .setTimeout(TimeoutInfinite)
      .build();
    transaction.sign(sourceKeypair);

    expect(port.verify(verifyInput(transaction.toXdr()))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "timebounds" }
    });
  });

  it("rejects an envelope whose expiry has passed", () => {
    const declared = terms({ expiresAt: new Date((NOW_SECONDS + 10) * 1000).toISOString() });
    const signed = signedEnvelope(declared);
    vi.setSystemTime((NOW_SECONDS + 20) * 1000);

    expect(port.verify(verifyInput(signed, { expiresAt: declared.expiresAt }))).toEqual({
      ok: false,
      error: { code: "expired", reason: "timebounds" }
    });
  });

  describe("an altered envelope carrying the original signature is refused", () => {
    it("refuses an envelope whose recipient destination was changed", () => {
      const foreign = signatureOver(terms());
      const altered = terms({
        recipients: [
          { accountId: otherKeypair.publicKey(), amountStroops: FIRST_RECIPIENT.amountStroops },
          SECOND_RECIPIENT
        ]
      });

      expect(port.verify(verifyInput(tamperedEnvelope(altered, foreign), { recipients: altered.recipients }))).toEqual(
        { ok: false, error: { code: "invalid_signature", reason: "signature" } }
      );
    });

    it("refuses an envelope whose recipient amount was changed", () => {
      const foreign = signatureOver(terms());
      const altered = terms({
        recipients: [
          { ...FIRST_RECIPIENT, amountStroops: FIRST_RECIPIENT.amountStroops + 1n },
          SECOND_RECIPIENT
        ]
      });

      expect(port.verify(verifyInput(tamperedEnvelope(altered, foreign), { recipients: altered.recipients }))).toEqual(
        { ok: false, error: { code: "invalid_signature", reason: "signature" } }
      );
    });

    it("refuses an envelope whose recipient order was changed", () => {
      const foreign = signatureOver(terms());
      const altered = terms({ recipients: [SECOND_RECIPIENT, FIRST_RECIPIENT] });

      expect(port.verify(verifyInput(tamperedEnvelope(altered, foreign), { recipients: altered.recipients }))).toEqual(
        { ok: false, error: { code: "invalid_signature", reason: "signature" } }
      );
    });

    it("refuses an envelope whose memo was changed", () => {
      const foreign = signatureOver(terms({ memo: "distribution-alpha" }));
      const altered = terms({ memo: "distribution-beta" });

      expect(port.verify(verifyInput(tamperedEnvelope(altered, foreign), { memo: "distribution-beta" }))).toEqual({
        ok: false,
        error: { code: "invalid_signature", reason: "signature" }
      });
    });

    it("refuses an envelope whose sequence was changed", () => {
      const foreign = signatureOver(terms());
      const altered = terms({ sourceSequence: "123456791" });

      expect(
        port.verify(verifyInput(tamperedEnvelope(altered, foreign), { sourceSequence: "123456792" }))
      ).toEqual({ ok: false, error: { code: "invalid_signature", reason: "signature" } });
    });
  });
});

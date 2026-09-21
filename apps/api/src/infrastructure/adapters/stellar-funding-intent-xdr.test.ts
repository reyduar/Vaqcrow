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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BuildFundingIntentXdrInput,
  BuiltFundingIntentXdr,
  VerifyFundingIntentXdrInput
} from "../../application/ports/funding-intent-xdr-port.js";
import { StellarFundingIntentXdr } from "./stellar-funding-intent-xdr.js";

/**
 * Every test runs offline: keypairs are generated locally, the account is a
 * local `Account`, and no Horizon or RPC client is ever constructed. A signature
 * is a pure function of a key and a transaction hash, so the whole build/verify
 * surface is exercised without a network.
 */

const NETWORK_PASSPHRASE = Networks.TESTNET;
/** A passphrase that is deliberately not the one the transactions are built for. */
const OTHER_NETWORK_PASSPHRASE = "Vaqcrow Test Network ; September 2026";

/** Frozen wall clock. Time bounds and `expiresAt` are only meaningful against a fixed now. */
const NOW_SECONDS = 1_800_000_000;
const MAX_TIME = NOW_SECONDS + 900;
const EXPIRES_AT = new Date(MAX_TIME * 1000).toISOString();

/** The account sequence the caller supplies to `build`. */
const SOURCE_SEQUENCE = "123456789";
/** The effective sequence the builder encodes, which `verify` expects. */
const EFFECTIVE_SEQUENCE = "123456790";
const AMOUNT_STROOPS = 10_0000000n;

const sourceKeypair = Keypair.random();
const destinationKeypair = Keypair.random();
const otherKeypair = Keypair.random();

const port = new StellarFundingIntentXdr();

function buildInput(overrides: Partial<BuildFundingIntentXdrInput> = {}): BuildFundingIntentXdrInput {
  return {
    networkPassphrase: NETWORK_PASSPHRASE,
    sourceAccountId: sourceKeypair.publicKey(),
    sourceSequence: SOURCE_SEQUENCE,
    destinationAccountId: destinationKeypair.publicKey(),
    amountStroops: AMOUNT_STROOPS,
    maxTimeUnixSeconds: MAX_TIME,
    ...overrides
  };
}

function expectBuilt(input: BuildFundingIntentXdrInput): BuiltFundingIntentXdr {
  const result = port.build(input);

  if (!result.ok) {
    throw new Error(`expected build to succeed, got ${result.error.code}`);
  }

  return result.value;
}

/** Decodes the adapter's own unsigned XDR, signs it with `signer`, and re-serialises. */
function signedEnvelope(input: BuildFundingIntentXdrInput, signer: Keypair = sourceKeypair): string {
  const built = expectBuilt(input);
  const transaction = TransactionBuilder.fromXDR(built.xdr, input.networkPassphrase) as Transaction;
  transaction.sign(signer);
  return transaction.toXdr();
}

/** A signature bound to one transaction's hash, for attaching to a different one. */
function signatureOver(input: BuildFundingIntentXdrInput, signer: Keypair = sourceKeypair) {
  const built = expectBuilt(input);
  const transaction = TransactionBuilder.fromXDR(built.xdr, input.networkPassphrase) as Transaction;
  return signer.signDecorated(transaction.hash());
}

function verifyInput(
  xdr: string,
  overrides: Partial<VerifyFundingIntentXdrInput> = {}
): VerifyFundingIntentXdrInput {
  return {
    xdr,
    networkPassphrase: NETWORK_PASSPHRASE,
    sourceAccountId: sourceKeypair.publicKey(),
    sourceSequence: EFFECTIVE_SEQUENCE,
    destinationAccountId: destinationKeypair.publicKey(),
    amountStroops: AMOUNT_STROOPS,
    expiresAt: EXPIRES_AT,
    ...overrides
  };
}

/** Builds for `target`, then grafts a signature made over a different hash onto it. */
function tamperedEnvelope(
  target: BuildFundingIntentXdrInput,
  foreignSignature: ReturnType<typeof signatureOver>
): string {
  const built = expectBuilt(target);
  const transaction = TransactionBuilder.fromXDR(built.xdr, target.networkPassphrase) as Transaction;
  transaction.addDecoratedSignature(foreignSignature);
  return transaction.toXdr();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_SECONDS * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("StellarFundingIntentXdr.build", () => {
  it("builds an unsigned native payment matching the intent", () => {
    const built = expectBuilt(buildInput());
    const transaction = TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE) as Transaction;
    const operation = transaction.operations[0];

    if (operation === undefined || operation.type !== "payment") {
      throw new Error("expected exactly one payment operation");
    }

    expect(transaction.source).toBe(sourceKeypair.publicKey());
    expect(transaction.sequence).toBe("123456790");
    expect(transaction.networkPassphrase).toBe(NETWORK_PASSPHRASE);
    expect(transaction.signatures).toHaveLength(0);
    expect(operation.destination).toBe(destinationKeypair.publicKey());
    expect(operation.asset.equals(Asset.native())).toBe(true);
    expect(operation.amount).toBe("10.0000000");
    expect(transaction.memo.type).toBe("none");
  });

  it("echoes the fields the caller has to persist", () => {
    const built = expectBuilt(buildInput());

    expect(built).toMatchObject({
      networkPassphrase: NETWORK_PASSPHRASE,
      sourceAccountId: sourceKeypair.publicKey(),
      sourceSequence: EFFECTIVE_SEQUENCE,
      destinationAccountId: destinationKeypair.publicKey(),
      amountStroops: AMOUNT_STROOPS,
      expiresAt: EXPIRES_AT
    });
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
    expect(Number(bounds.maxTime)).toBeGreaterThan(Number(bounds.minTime));
  });

  it("sets a default upper bound when the caller supplies none", () => {
    const { maxTimeUnixSeconds, ...withoutMaxTime } = buildInput();
    expect(maxTimeUnixSeconds).toBe(MAX_TIME);

    const built = expectBuilt(withoutMaxTime);
    const transaction = TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE) as Transaction;
    const bounds = transaction.timeBounds;

    if (bounds === undefined) {
      throw new Error("expected time bounds to be set");
    }

    // The requirement is that they are never unbounded, so the default must be a
    // real upper bound strictly after now.
    expect(bounds.maxTime).not.toBe("0");
    expect(Number(bounds.maxTime)).toBeGreaterThan(NOW_SECONDS);
    expect(new Date(built.expiresAt).getTime()).toBe(Number(bounds.maxTime) * 1000);
  });

  it("attaches a text memo when one is requested", () => {
    const built = expectBuilt(buildInput({ memo: "intent-alpha" }));
    const transaction = TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE) as Transaction;

    expect(transaction.memo.type).toBe("text");
    expect(new TextDecoder().decode(transaction.memo.value as Uint8Array)).toBe("intent-alpha");
  });

  it("returns invalid_input instead of throwing on an unbuildable intent", () => {
    // A text memo is capped at 28 bytes by the protocol; asking for more must be
    // a caller error, not an exception escaping the port.
    const result = port.build(buildInput({ memo: "x".repeat(29) }));

    expect(result).toEqual({ ok: false, error: { code: "invalid_input" } });
  });

  it("refuses an upper bound that has already passed", () => {
    const result = port.build(buildInput({ maxTimeUnixSeconds: NOW_SECONDS }));

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_input", reason: "maxTimeUnixSeconds" }
    });
  });
});

describe("StellarFundingIntentXdr.verify", () => {
  it("accepts the intent's own signed envelope and reports the transaction hash", () => {
    const signed = signedEnvelope(buildInput());
    const decoded = TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE) as Transaction;

    const result = port.verify(verifyInput(signed));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.transactionHash).toBe(Buffer.from(decoded.hash()).toString("hex"));
    expect(result.value.sourceAccountId).toBe(sourceKeypair.publicKey());
    expect(result.value.destinationAccountId).toBe(destinationKeypair.publicKey());
    expect(result.value.amountStroops).toBe(AMOUNT_STROOPS);
    expect(result.value.expiresAt).toBe(EXPIRES_AT);
  });

  it("rejects malformed XDR", () => {
    expect(port.verify(verifyInput("not-a-transaction"))).toEqual({
      ok: false,
      error: { code: "malformed_xdr", reason: "envelope" }
    });
  });

  it("rejects a fee-bump envelope", () => {
    // D8: the outer fee payer must not be able to wrap a different inner
    // transaction past the allowlist.
    const inner = TransactionBuilder.fromXDR(expectBuilt(buildInput()).xdr, NETWORK_PASSPHRASE) as Transaction;
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
      .addOperation(Operation.manageData({ name: "intent", value: "alpha" }))
      .build();
    transaction.sign(sourceKeypair);

    expect(port.verify(verifyInput(transaction.toXdr()))).toEqual({
      ok: false,
      error: { code: "unsupported_operation", reason: "operation_type" }
    });
  });

  it("rejects an envelope carrying more than one operation", () => {
    const transaction = new TransactionBuilder(
      new Account(sourceKeypair.publicKey(), SOURCE_SEQUENCE),
      { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE, timebounds: timeBounds() }
    )
      .addOperation(
        Operation.payment({
          destination: destinationKeypair.publicKey(),
          asset: Asset.native(),
          amount: "10.0000000"
        })
      )
      .addOperation(
        Operation.payment({
          destination: destinationKeypair.publicKey(),
          asset: Asset.native(),
          amount: "1.0000000"
        })
      )
      .build();
    transaction.sign(sourceKeypair);

    expect(port.verify(verifyInput(transaction.toXdr()))).toEqual({
      ok: false,
      error: { code: "unsupported_operation", reason: "operation_count" }
    });
  });

  it("rejects an envelope with no signature", () => {
    const built = expectBuilt(buildInput());

    expect(port.verify(verifyInput(built.xdr))).toEqual({
      ok: false,
      error: { code: "invalid_signature", reason: "missing" }
    });
  });

  it("rejects a valid signature produced for another network", () => {
    // The passphrase is what the signature hash is derived from, so a Testnet
    // signature does not verify once the envelope is judged against another
    // network. The check is cryptographic; no passphrase string comparison is
    // involved.
    const built = expectBuilt(buildInput());
    const transaction = TransactionBuilder.fromXDR(built.xdr, OTHER_NETWORK_PASSPHRASE) as Transaction;
    transaction.sign(sourceKeypair);

    expect(port.verify(verifyInput(transaction.toXdr()))).toEqual({
      ok: false,
      error: { code: "invalid_signature", reason: "signature" }
    });
  });

  it("rejects a signature that did not come from the expected source", () => {
    const signed = signedEnvelope(buildInput(), otherKeypair);

    expect(port.verify(verifyInput(signed))).toEqual({
      ok: false,
      error: { code: "invalid_signature", reason: "signature" }
    });
  });

  it("rejects a destination that differs from the intent", () => {
    const signed = signedEnvelope(buildInput());

    expect(port.verify(verifyInput(signed, { destinationAccountId: otherKeypair.publicKey() }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "destination" }
    });
  });

  it("rejects an amount that differs from the intent", () => {
    const signed = signedEnvelope(buildInput());

    expect(port.verify(verifyInput(signed, { amountStroops: AMOUNT_STROOPS + 1n }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "amount" }
    });
  });

  it("rejects a memo that differs from the intent", () => {
    const signed = signedEnvelope(buildInput({ memo: "intent-alpha" }));

    expect(port.verify(verifyInput(signed, { memo: "intent-beta" }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "memo" }
    });
    expect(port.verify(verifyInput(signed))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "memo" }
    });
  });

  it("accepts an envelope whose memo matches the intent", () => {
    const signed = signedEnvelope(buildInput({ memo: "intent-alpha" }));

    expect(port.verify(verifyInput(signed, { memo: "intent-alpha" })).ok).toBe(true);
  });

  it("rejects a sequence that differs from the intent", () => {
    const signed = signedEnvelope(buildInput());

    expect(port.verify(verifyInput(signed, { sourceSequence: "123456792" }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "sequence" }
    });
  });

  it("rejects a source that differs from the intent", () => {
    const signed = signedEnvelope(buildInput());

    expect(port.verify(verifyInput(signed, { sourceAccountId: otherKeypair.publicKey() }))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "source" }
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
          destination: destinationKeypair.publicKey(),
          asset: creditAsset,
          amount: "10.0000000"
        })
      )
      .build();
    transaction.sign(sourceKeypair);

    expect(port.verify(verifyInput(transaction.toXdr()))).toEqual({
      ok: false,
      error: { code: "intent_mismatch", reason: "asset" }
    });
  });

  it("rejects an envelope whose time bounds do not match the intent's expiry", () => {
    const built = expectBuilt(buildInput());
    const transaction = TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE) as Transaction;
    transaction.sign(sourceKeypair);

    // The expiry is a minute later than the signed envelope's upper bound.
    expect(
      port.verify(
        verifyInput(transaction.toXdr(), {
          expiresAt: new Date((MAX_TIME + 60) * 1000).toISOString()
        })
      )
    ).toEqual({ ok: false, error: { code: "intent_mismatch", reason: "timebounds" } });
  });

  it("rejects an envelope with unbounded time bounds", () => {
    const transaction = new TransactionBuilder(
      new Account(sourceKeypair.publicKey(), SOURCE_SEQUENCE),
      { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }
    )
      .addOperation(
        Operation.payment({
          destination: destinationKeypair.publicKey(),
          asset: Asset.native(),
          amount: "10.0000000"
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

  it("rejects an intent whose expiry has passed", () => {
    const built = expectBuilt(buildInput({ maxTimeUnixSeconds: NOW_SECONDS + 10 }));
    const transaction = TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE) as Transaction;
    transaction.sign(sourceKeypair);
    vi.setSystemTime((NOW_SECONDS + 20) * 1000);

    expect(port.verify(verifyInput(transaction.toXdr(), { expiresAt: built.expiresAt }))).toEqual({
      ok: false,
      error: { code: "expired", reason: "timebounds" }
    });
  });

  describe("criterion 1 — an altered envelope carrying the original signature is refused", () => {
    it("refuses an envelope whose destination was changed", () => {
      const foreign = signatureOver(buildInput());
      const altered = tamperedEnvelope(
        buildInput({ destinationAccountId: otherKeypair.publicKey() }),
        foreign
      );

      expect(port.verify(verifyInput(altered, { destinationAccountId: otherKeypair.publicKey() }))).toEqual({
        ok: false,
        error: { code: "invalid_signature", reason: "signature" }
      });
    });

    it("refuses an envelope whose amount was changed", () => {
      const foreign = signatureOver(buildInput());
      const altered = tamperedEnvelope(buildInput({ amountStroops: AMOUNT_STROOPS + 1n }), foreign);

      expect(port.verify(verifyInput(altered, { amountStroops: AMOUNT_STROOPS + 1n }))).toEqual({
        ok: false,
        error: { code: "invalid_signature", reason: "signature" }
      });
    });

    it("refuses an envelope whose memo was changed", () => {
      const foreign = signatureOver(buildInput({ memo: "intent-alpha" }));
      const altered = tamperedEnvelope(buildInput({ memo: "intent-beta" }), foreign);

      expect(port.verify(verifyInput(altered, { memo: "intent-beta" }))).toEqual({
        ok: false,
        error: { code: "invalid_signature", reason: "signature" }
      });
    });

    it("refuses an envelope whose sequence was changed", () => {
      const foreign = signatureOver(buildInput());
      const altered = tamperedEnvelope(buildInput({ sourceSequence: "123456791" }), foreign);

      expect(port.verify(verifyInput(altered, { sourceSequence: "123456792" }))).toEqual({
        ok: false,
        error: { code: "invalid_signature", reason: "signature" }
      });
    });

    it("refuses an envelope whose source was changed", () => {
      // The signature is the source account's, so swapping the source changes
      // both the expected signer and the signed bytes.
      const foreign = signatureOver(buildInput());
      const altered = tamperedEnvelope(buildInput({ sourceAccountId: otherKeypair.publicKey() }), foreign);

      expect(port.verify(verifyInput(altered, { sourceAccountId: otherKeypair.publicKey() }))).toEqual({
        ok: false,
        error: { code: "invalid_signature", reason: "signature" }
      });
    });
  });
});

function timeBounds(): { minTime: string; maxTime: string } {
  return { minTime: String(NOW_SECONDS), maxTime: String(MAX_TIME) };
}

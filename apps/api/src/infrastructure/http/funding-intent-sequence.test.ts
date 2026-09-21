import {
  Account,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder
} from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";
import { parseFundingIntentId } from "@vaqcrow/contracts";
import type { CorrelationId } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { BuildFundingIntentXdrInput } from "../../application/ports/funding-intent-xdr-port.js";
import type {
  FundingIntentRecord,
  FundingIntentRepositoryPort,
  FundingIntentSubmission
} from "../../application/ports/funding-intent-repository-port.js";
import type { LedgerAccount, LedgerPort } from "../../application/ports/ledger-port.js";
import { StellarFundingIntentXdr } from "../adapters/stellar-funding-intent-xdr.js";
import { buildApp } from "./build-app.js";
import type { FundingIntentRouteDependencies } from "./routes/funding-intent.route.js";

/**
 * `DEMO.md` §11, level "Vitest — funcional de API": the sequence
 * build -> verify -> submit, through the routes, with success, rejection and
 * idempotency.
 *
 * The gap this file closes: every other funding-intent test drives *either* the
 * real `StellarFundingIntentXdr` with no HTTP surface, *or* the HTTP surface
 * with a fake verifier. Nothing built and signed a real envelope and pushed it
 * through the real route, so "an altered XDR rejects" was proven at the adapter
 * level and merely asserted at the route level, never observed end to end.
 *
 * Here the real verifier is wired into `buildApp`; only the ledger and the
 * repository are doubles. A locally generated keypair signs a locally built
 * envelope, so the whole suite runs offline: no Testnet, Horizon or wallet.
 */

const NETWORK = "testnet";
const NETWORK_PASSPHRASE = Networks.TESTNET;
/** A passphrase the prepared envelope is deliberately *not* signed for. */
const OTHER_NETWORK_PASSPHRASE = "Vaqcrow Test Network ; September 2026";

/** The account sequence the fake ledger reports; the builder encodes one more. */
const RAW_SEQUENCE = "1234567890";
const AMOUNT_STROOPS = 10_000_000n;
const PREPARED_MEMO = "intent-alpha";
const INTENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const CREATED_AT = "2026-09-21T12:00:00.000Z";
const UPDATED_AT = "2026-09-21T12:00:05.000Z";

/** Ephemeral, in-memory signers; the non-custody scan opts test files in. */
const source = Keypair.random();
const destination = Keypair.random();
const other = Keypair.random();

/** A second verifier instance, used to construct altered envelopes realistically. */
const builder = new StellarFundingIntentXdr();

/** The prepare response as it crosses the wire: money is a decimal string. */
interface PreparedWire {
  readonly intentId: string;
  readonly xdr: string;
  readonly network: string;
  readonly networkPassphrase: string;
  readonly sourceAccountId: string;
  readonly sourceSequence: string;
  readonly destinationAccountId: string;
  readonly amountStroops: string;
  readonly memo: string | null;
  readonly expiresAt: string;
  readonly applicationId: string | null;
}

/** Exactly the fields the signed envelope commits to (`fundingIntentTermsSchema`). */
type TermsWire = Omit<PreparedWire, "intentId" | "xdr" | "applicationId">;

interface CapturedSubmission {
  readonly record: FundingIntentSubmission;
  readonly correlationId: CorrelationId;
}

interface Harness {
  readonly app: FastifyInstance;
  readonly submissions: CapturedSubmission[];
}

const preparedBody = {
  sourceAccountId: source.publicKey(),
  destinationAccountId: destination.publicKey(),
  amountStroops: AMOUNT_STROOPS.toString(),
  memo: PREPARED_MEMO,
  applicationId: null
};

function termsOf(prepared: PreparedWire): TermsWire {
  return {
    network: prepared.network,
    networkPassphrase: prepared.networkPassphrase,
    sourceAccountId: prepared.sourceAccountId,
    sourceSequence: prepared.sourceSequence,
    destinationAccountId: prepared.destinationAccountId,
    amountStroops: prepared.amountStroops,
    memo: prepared.memo,
    expiresAt: prepared.expiresAt
  };
}

function ledger(): LedgerPort {
  const account: LedgerAccount = {
    accountId: source.publicKey(),
    sequence: RAW_SEQUENCE,
    nativeBalanceStroops: 50_000_000n
  };

  return { getAccount: async () => ({ ok: true, value: account }) };
}

/**
 * An in-memory repository that mirrors the port's idempotency contract. It is a
 * fake, not a mock: it makes the replay path observable end to end (a second
 * identical submission returns the original row with `applied: false`) while
 * every verified fact it stores comes from what the real use case submitted.
 */
function inMemoryRepository(submissions: CapturedSubmission[]): FundingIntentRepositoryPort {
  const byIntentId = new Map<string, FundingIntentRecord>();
  const hashOwners = new Map<string, string>();

  return {
    async submit({ record, correlationId }) {
      submissions.push({ record, correlationId });

      const existing = byIntentId.get(record.intentId);

      if (existing) {
        return existing.transactionHash === record.transactionHash
          ? { ok: true, value: { record: existing, applied: false } }
          : { ok: false, error: { code: "idempotency_conflict" } };
      }

      if (hashOwners.has(record.transactionHash)) {
        return { ok: false, error: { code: "idempotency_conflict" } };
      }

      const persisted: FundingIntentRecord = {
        ...record,
        state: "submitted",
        lastCorrelationId: correlationId,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT
      };

      byIntentId.set(record.intentId, persisted);
      hashOwners.set(record.transactionHash, record.intentId);

      return { ok: true, value: { record: persisted, applied: true } };
    },

    async findById(intentId) {
      const found = byIntentId.get(intentId);

      return found ? { ok: true, value: found } : { ok: false, error: { code: "not_found" } };
    }
  };
}

let activeApp: FastifyInstance | undefined;

afterEach(async () => {
  await activeApp?.close();
  activeApp = undefined;
});

function start(): Harness {
  const submissions: CapturedSubmission[] = [];
  const dependencies: FundingIntentRouteDependencies = {
    ledger: ledger(),
    // The real verifier: no XDR double anywhere in this suite.
    xdr: new StellarFundingIntentXdr(),
    repository: inMemoryRepository(submissions),
    network: { network: NETWORK, networkPassphrase: NETWORK_PASSPHRASE },
    generateIntentId: () => parseFundingIntentId(INTENT_ID)
  };
  const app = buildApp({ fundingIntent: dependencies });
  activeApp = app;

  return { app, submissions };
}

async function prepare(
  app: FastifyInstance,
  overrides: Readonly<Record<string, unknown>> = {}
): Promise<PreparedWire> {
  const response = await app.inject({
    method: "POST",
    url: "/funding-intents",
    payload: { ...preparedBody, ...overrides }
  });

  expect(response.statusCode).toBe(200);

  return response.json().intent as PreparedWire;
}

function submissionUrl(prepared: PreparedWire): string {
  return `/funding-intents/${prepared.intentId}/submission`;
}

/** Decodes an envelope; the SDK never returns a fee-bump for these inputs. */
function decode(xdr: string, passphrase: string = NETWORK_PASSPHRASE): Transaction {
  return TransactionBuilder.fromXDR(xdr, passphrase) as Transaction;
}

/** Signs the prepared (unsigned) envelope with the source account's local key. */
function signPrepared(prepared: PreparedWire, signer: Keypair = source): string {
  const transaction = decode(prepared.xdr);
  transaction.sign(signer);

  return transaction.toXdr();
}

/** The hash the network would compute for a signed envelope, derived independently. */
function transactionHashOf(signedXdr: string): string {
  return Buffer.from(decode(signedXdr).hash()).toString("hex");
}

/** The signature the source account produced over the *original* intent's bytes. */
function originalSignature(prepared: PreparedWire): ReturnType<Keypair["signDecorated"]> {
  return source.signDecorated(decode(prepared.xdr).hash());
}

function rawSequenceOf(prepared: PreparedWire): string {
  return (BigInt(prepared.sourceSequence) - 1n).toString();
}

function maxTimeOf(prepared: PreparedWire): number {
  return Math.floor(Date.parse(prepared.expiresAt) / 1000);
}

/**
 * Builds a *different* envelope with the real builder and grafts the original
 * signature onto it — a post-signature alteration that still carries a
 * plausible signature, which is exactly the attack criterion 1 describes. The
 * memo defaults to the prepared intent's so that only the targeted field
 * differs; otherwise a stray memo mismatch would answer before the field under
 * test.
 */
function alteredEnvelope(
  prepared: PreparedWire,
  overrides: Readonly<Partial<BuildFundingIntentXdrInput>>
): string {
  const built = builder.build({
    networkPassphrase: NETWORK_PASSPHRASE,
    sourceAccountId: source.publicKey(),
    sourceSequence: rawSequenceOf(prepared),
    destinationAccountId: destination.publicKey(),
    amountStroops: AMOUNT_STROOPS,
    memo: PREPARED_MEMO,
    maxTimeUnixSeconds: maxTimeOf(prepared),
    ...overrides
  });

  if (!built.ok) {
    throw new Error(`expected the altered envelope to build, got ${built.error.code}`);
  }

  const transaction = decode(built.value.xdr);
  transaction.addDecoratedSignature(originalSignature(prepared));

  return transaction.toXdr();
}

interface RefusalCase {
  readonly description: string;
  readonly build: (prepared: PreparedWire) => {
    readonly signedXdr: string;
    readonly intent: TermsWire;
  };
}

const refusalCases: readonly RefusalCase[] = [
  {
    description: "a destination that differs from the declared intent",
    build: (prepared) => ({
      signedXdr: alteredEnvelope(prepared, { destinationAccountId: other.publicKey() }),
      intent: termsOf(prepared)
    })
  },
  {
    description: "an amount that differs from the declared intent",
    build: (prepared) => ({
      signedXdr: alteredEnvelope(prepared, { amountStroops: AMOUNT_STROOPS + 1n }),
      intent: termsOf(prepared)
    })
  },
  {
    description: "a memo that differs from the declared intent",
    build: (prepared) => ({
      signedXdr: alteredEnvelope(prepared, { memo: "intent-beta" }),
      intent: termsOf(prepared)
    })
  },
  {
    description: "a source that differs from the declared intent",
    build: (prepared) => ({
      signedXdr: alteredEnvelope(prepared, { sourceAccountId: other.publicKey() }),
      intent: termsOf(prepared)
    })
  },
  {
    description: "a sequence that differs from the declared intent",
    build: (prepared) => ({
      signedXdr: alteredEnvelope(prepared, {
        sourceSequence: (BigInt(rawSequenceOf(prepared)) + 1n).toString()
      }),
      intent: termsOf(prepared)
    })
  },
  {
    description: "timebounds that differ from the declared intent",
    build: (prepared) => ({
      signedXdr: alteredEnvelope(prepared, { maxTimeUnixSeconds: maxTimeOf(prepared) + 60 }),
      intent: termsOf(prepared)
    })
  },
  {
    description: "a signature produced for another network",
    build: (prepared) => {
      const transaction = decode(prepared.xdr, OTHER_NETWORK_PASSPHRASE);
      transaction.sign(source);

      return { signedXdr: transaction.toXdr(), intent: termsOf(prepared) };
    }
  },
  {
    // The declared intent follows the altered envelope, so every field compares
    // equal and only the signature stands between the alteration and
    // submission. This is the cryptographic half of criterion 1.
    description: "a signature that authorizes different bytes",
    build: (prepared) => ({
      signedXdr: alteredEnvelope(prepared, { destinationAccountId: other.publicKey() }),
      intent: { ...termsOf(prepared), destinationAccountId: other.publicKey() }
    })
  }
];

describe("funding intent sequence (real XDR verifier, real HTTP surface)", () => {
  it("prepares an unsigned envelope, signs it locally and answers 202 with the persisted record", async () => {
    const { app, submissions } = start();
    const prepared = await prepare(app);

    // The prepare step hands out an unsigned envelope; nothing is persisted yet.
    expect(decode(prepared.xdr).signatures).toHaveLength(0);
    expect(submissions).toHaveLength(0);

    const signedXdr = signPrepared(prepared);
    const response = await app.inject({
      method: "POST",
      url: submissionUrl(prepared),
      payload: { signedXdr, intent: termsOf(prepared), applicationId: prepared.applicationId }
    });

    expect(response.statusCode).toBe(202);

    const expectedHash = transactionHashOf(signedXdr);

    expect(response.json()).toEqual({
      applied: true,
      intent: {
        ...termsOf(prepared),
        intentId: prepared.intentId,
        state: "submitted",
        transactionHash: expectedHash,
        applicationId: null,
        lastCorrelationId: expect.any(String),
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT
      }
    });

    // The verified hash reaches the repository, and the envelope that was
    // actually signed — not the unsigned one the server built — is persisted.
    const captured = submissions[0];
    expect(captured?.record.transactionHash).toBe(expectedHash);
    expect(captured?.record.signedXdr).toBe(signedXdr);
    expect(captured?.record.amountStroops).toBe(AMOUNT_STROOPS);
    expect(captured?.record.sourceAccountId).toBe(source.publicKey());
    expect(captured?.record.destinationAccountId).toBe(destination.publicKey());
  });

  it.each(refusalCases)("refuses $description with 422 xdr_rejected and persists nothing", async ({ build }) => {
    const { app, submissions } = start();
    const prepared = await prepare(app);
    const { signedXdr, intent } = build(prepared);

    const response = await app.inject({
      method: "POST",
      url: submissionUrl(prepared),
      payload: { signedXdr, intent, applicationId: prepared.applicationId }
    });

    expect(response.statusCode).toBe(422);
    // Deep equality to the single-field body is the non-leak assertion: the
    // port's `reason` (`destination`, `signature`, `timebounds`, …) names the
    // failing field, and describing the envelope back to whoever tampered with
    // it would hand them the oracle they are probing for.
    expect(response.json()).toEqual({ code: "xdr_rejected" });
    expect(submissions).toHaveLength(0);
  });

  it("refuses a fee-bump envelope the same way", async () => {
    const { app, submissions } = start();
    const prepared = await prepare(app);

    const inner = decode(prepared.xdr);
    inner.sign(source);
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      other,
      BASE_FEE,
      inner,
      NETWORK_PASSPHRASE
    );

    const response = await app.inject({
      method: "POST",
      url: submissionUrl(prepared),
      payload: {
        signedXdr: feeBump.toXdr(),
        intent: termsOf(prepared),
        applicationId: prepared.applicationId
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "xdr_rejected" });
    expect(submissions).toHaveLength(0);
  });

  it("refuses an envelope whose single operation is not a payment", async () => {
    const { app, submissions } = start();
    const prepared = await prepare(app);

    const transaction = new TransactionBuilder(
      new Account(source.publicKey(), rawSequenceOf(prepared)),
      {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: "0", maxTime: String(maxTimeOf(prepared)) }
      }
    )
      .addOperation(Operation.manageData({ name: "funding-intent", value: "alpha" }))
      .build();
    transaction.sign(source);

    const response = await app.inject({
      method: "POST",
      url: submissionUrl(prepared),
      payload: {
        signedXdr: transaction.toXdr(),
        intent: termsOf(prepared),
        applicationId: prepared.applicationId
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "xdr_rejected" });
    expect(submissions).toHaveLength(0);
  });

  it("distinguishes a malformed body (400) from a well-formed but refused envelope (422)", async () => {
    const { app } = start();
    const prepared = await prepare(app);

    const malformed = await app.inject({
      method: "POST",
      url: submissionUrl(prepared),
      // `applicationId` is a required key of the submit command, so its absence
      // is a body that drifted from the contract, not a semantic refusal.
      payload: { signedXdr: signPrepared(prepared), intent: termsOf(prepared) }
    });

    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({ code: "invalid_request" });

    const refused = await app.inject({
      method: "POST",
      url: submissionUrl(prepared),
      payload: {
        signedXdr: alteredEnvelope(prepared, { destinationAccountId: other.publicKey() }),
        intent: termsOf(prepared),
        applicationId: prepared.applicationId
      }
    });

    expect(refused.statusCode).toBe(422);
    expect(refused.json()).toEqual({ code: "xdr_rejected" });
    expect(malformed.statusCode).not.toBe(refused.statusCode);
  });

  it("reports an exact replay as 200 applied:false instead of swallowing it", async () => {
    const { app } = start();
    const prepared = await prepare(app);
    const signedXdr = signPrepared(prepared);
    const payload = { signedXdr, intent: termsOf(prepared), applicationId: prepared.applicationId };

    const first = await app.inject({ method: "POST", url: submissionUrl(prepared), payload });
    expect(first.statusCode).toBe(202);
    expect(first.json().applied).toBe(true);

    const replay = await app.inject({ method: "POST", url: submissionUrl(prepared), payload });

    expect(replay.statusCode).toBe(200);
    expect(replay.json().applied).toBe(false);
    expect(replay.json().intent.transactionHash).toBe(transactionHashOf(signedXdr));
    expect(replay.json().intent.intentId).toBe(prepared.intentId);
  });
});

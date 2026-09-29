import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Keypair,
  NetworkError,
  NotFoundError,
  TransactionBuilder,
  TransactionFailedError
} from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { generateCorrelationId, parseRevenueShareDistributionId } from "@vaqcrow/contracts";
import type { CorrelationId } from "@vaqcrow/contracts";
import { STELLAR_TESTNET_NETWORK_PASSPHRASE } from "../../application/config/stellar-config.js";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import { confirmRevenueShareDistributions } from "../../application/use-cases/confirm-revenue-share-distributions.js";
import type { ConfirmRevenueShareDistributionsResult } from "../../application/use-cases/confirm-revenue-share-distributions.js";
import { StellarLedger } from "../adapters/stellar-ledger.js";
import type { HorizonAccountSource } from "../adapters/stellar-ledger.js";
import { StellarRevenueShareDistributionXdr } from "../adapters/stellar-revenue-share-distribution-xdr.js";
import { StellarTransaction } from "../adapters/stellar-transaction.js";
import type {
  HorizonSubmitAsyncResponse,
  HorizonTransactionRecord,
  HorizonTransactionSource
} from "../adapters/stellar-transaction.js";
import { SupabaseRevenueShareDistributionRepository } from "../adapters/supabase-revenue-share-distribution-repository.js";
import { ConfirmationScheduler } from "../scheduling/confirmation-scheduler.js";
import type { ConfirmationPolicy } from "../scheduling/confirmation-policy.js";
import { buildApp } from "./build-app.js";

/**
 * The revenue-share distribution vertical observed end to end, with a double
 * only at each provider edge.
 *
 * Everything Vaqcrow wrote runs for real: the real HTTP route, the real
 * `prepare`/`submit`/`get` use cases, the real `SupabaseRevenueShareDistributionRepository`,
 * the real `StellarRevenueShareDistributionXdr`, the real `StellarLedger` and the
 * real `StellarTransaction`. The doubles sit at the boundaries Vaqcrow does not
 * own — the Supabase client and Horizon — which is the narrowest level at which
 * a double can still be called effective.
 *
 * This suite complements the route suite (which doubles the repository and the
 * XDR port) and the repository suite (which scripts PostgREST by hand). Neither
 * observes a prepared envelope being signed, submitted, persisted and then
 * advanced by a poll and read back over HTTP, so neither would catch a
 * disagreement *between* the layers — a payload the repository cannot decode, a
 * state the contract and the adapter spell differently, a recipient list the
 * verifier recovers in the wrong order. The scenarios here are the ones the
 * Feature's testing strategy names: success, rejection, replay, fallback.
 */

const CONFIG: StellarConfig = {
  network: "testnet",
  horizonUrl: "https://horizon-testnet.stellar.org",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
  explorerUrl: "https://stellar.expert/explorer/testnet"
};

const EXPLORER_BASE_URL = CONFIG.explorerUrl as string;

const DISTRIBUTION_ID = parseRevenueShareDistributionId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const CORRELATION_ID: CorrelationId = generateCorrelationId();

/** The public account `prepare` reads from the (doubled) ledger. */
const sourceKeypair = Keypair.random();
const firstRecipientKeypair = Keypair.random();
const secondRecipientKeypair = Keypair.random();

const SOURCE_ACCOUNT = sourceKeypair.publicKey();
const FIRST_RECIPIENT = firstRecipientKeypair.publicKey();
const SECOND_RECIPIENT = secondRecipientKeypair.publicKey();

/** One XLM and a quarter, in stroops — exact integers, never floats. */
const FIRST_AMOUNT_STROOPS = 10_000_000n;
const SECOND_AMOUNT_STROOPS = 2_500_000n;
const FIRST_AMOUNT = FIRST_AMOUNT_STROOPS.toString();
const SECOND_AMOUNT = SECOND_AMOUNT_STROOPS.toString();

/** The account sequence the ledger reports; the builder increments it once. */
const ACCOUNT_SEQUENCE = "1234567890";

/** The ledger that includes a confirmed transaction, and its close time. */
const INCLUDING_LEDGER = 1_234_567;
const LEDGER_CLOSED_AT = "2026-09-21T12:00:04.000Z";

/** The injected clock and the row defaults the migration declares. */
const START = "2026-09-21T12:00:00.000Z";
const ROW_UPDATED_AT = "2026-09-21T12:00:05.000Z";

const POLICY: ConfirmationPolicy = {
  batchSize: 5,
  initialBackoffMs: 5_000,
  maxBackoffMs: 60_000
};

const PREPARE_BODY = {
  sourceAccountId: SOURCE_ACCOUNT,
  recipients: [
    { accountId: FIRST_RECIPIENT, amountStroops: FIRST_AMOUNT },
    { accountId: SECOND_RECIPIENT, amountStroops: SECOND_AMOUNT }
  ],
  memo: null,
  applicationId: null
};

/** The prepared distribution as it crosses the wire. */
interface WirePrepared {
  readonly distributionId: string;
  readonly xdr: string;
  readonly network: string;
  readonly networkPassphrase: string;
  readonly sourceAccountId: string;
  readonly sourceSequence: string;
  readonly memo: string | null;
  readonly expiresAt: string;
  readonly recipients: ReadonlyArray<{ readonly accountId: string; readonly amountStroops: string }>;
  readonly applicationId: string | null;
}

/**
 * The declared terms as the wire carries them: recipient amounts are decimal
 * strings, because a `bigint` is not JSON-serializable and a JSON number would
 * lose precision above 2^53. The route's contract parser turns them back into
 * `bigint` before the XDR port sees them.
 */
interface WireTerms {
  readonly network: string;
  readonly networkPassphrase: string;
  readonly sourceAccountId: string;
  readonly sourceSequence: string;
  readonly memo: string | null;
  readonly expiresAt: string;
  readonly recipients: ReadonlyArray<{ readonly accountId: string; readonly amountStroops: string }>;
}

/**
 * A stateful stand-in for PostgREST over `revenue_share_distribution`.
 *
 * It reproduces the server-side behaviours the adapter relies on and cannot
 * provide itself: the column defaults a fresh row receives, the nested insert
 * that commits parent and recipient rows together, and the conditional update
 * that matches on `state` as well as on `distribution_id`. That mirroring is a
 * real risk — a divergence from the migration would let this suite pass while
 * production failed — which is why the live integration suite asserts the real
 * columns and constraints exist. The mirror is verified from the other side
 * rather than trusted.
 */
function inMemoryDistributionStore(): {
  client: SupabaseClient;
  rows: Map<string, Record<string, unknown>>;
} {
  const rows = new Map<string, Record<string, unknown>>();

  type Terminal = "single" | "maybeSingle" | "list";

  function builder(table: string) {
    let op: "insert" | "select" | "update" = "select";
    let payload: Record<string, unknown> | undefined;
    const eqFilters: Array<readonly [string, unknown]> = [];
    let dueByOrBefore: string | undefined;
    let orderBy: string | undefined;
    let limitTo: number | undefined;
    let terminal: Terminal = "list";

    const matches = (row: Record<string, unknown>): boolean =>
      eqFilters.every(([column, value]) => row[column] === value) &&
      (dueByOrBefore === undefined || String(row["next_attempt_at"]) <= dueByOrBefore);

    function run(): { data: unknown; error: { code: string; message: string } | null } {
      if (table !== "revenue_share_distribution") {
        return { data: null, error: { code: "42P01", message: "unknown table" } };
      }

      if (op === "insert" && payload !== undefined) {
        const distributionId = payload["distribution_id"] as string;
        const transactionHash = payload["transaction_hash"] as string;

        // Both unique constraints the migration declares: the primary key on
        // `distribution_id` and the unique `transaction_hash`.
        const clash =
          rows.has(distributionId) ||
          [...rows.values()].some((row) => row["transaction_hash"] === transactionHash);

        if (clash) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }

        // The defaults the migration declares, plus the `updated_at` trigger. A
        // fresh row is due immediately, which is what lets a poll resume it.
        const stored: Record<string, unknown> = {
          confirmation_attempts: 0,
          next_attempt_at: START,
          confirmed_at: null,
          ledger_sequence: null,
          failure_reason: null,
          created_at: START,
          updated_at: START,
          ...payload
        };

        rows.set(distributionId, stored);
        return { data: stored, error: null };
      }

      if (op === "update" && payload !== undefined) {
        // The conditional half lives here: a transition only touches a row that
        // still matches its `state` filter, which is what makes a replayed
        // confirmation a non-application.
        const target = [...rows.values()].find(matches);

        if (target === undefined) {
          return { data: null, error: null };
        }

        Object.assign(target, payload, { updated_at: ROW_UPDATED_AT });
        return { data: target, error: null };
      }

      let selected = [...rows.values()].filter(matches);

      if (orderBy !== undefined) {
        const key = orderBy;
        selected = selected.sort((left, right) =>
          String(left[key]).localeCompare(String(right[key]))
        );
      }

      if (limitTo !== undefined) {
        selected = selected.slice(0, limitTo);
      }

      return { data: selected.map((row) => ({ ...row })), error: null };
    }

    const self = {
      insert: (input: Record<string, unknown>) => {
        op = "insert";
        payload = input;
        return self;
      },
      update: (input: Record<string, unknown>) => {
        op = "update";
        payload = input;
        return self;
      },
      select: () => self,
      eq: (column: string, value: unknown) => {
        eqFilters.push([column, value]);
        return self;
      },
      lte: (column: string, value: unknown) => {
        if (column !== "next_attempt_at") {
          throw new Error(`unexpected lte column: ${column}`);
        }
        dueByOrBefore = String(value);
        return self;
      },
      order: (column: string) => {
        orderBy = column;
        return self;
      },
      limit: (count: number) => {
        limitTo = count;
        return self;
      },
      single: () => {
        terminal = "single";
        return self;
      },
      maybeSingle: () => {
        terminal = "maybeSingle";
        return self;
      },
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected: (reason: unknown) => unknown
      ) => {
        const result = run();

        if (terminal === "maybeSingle" || terminal === "single") {
          const list = Array.isArray(result.data) ? result.data : result.data === null ? [] : [result.data];
          const first = list[0] ?? null;
          return Promise.resolve({ data: first, error: result.error }).then(onFulfilled, onRejected);
        }

        return Promise.resolve(result).then(onFulfilled, onRejected);
      }
    };

    return self;
  }

  return {
    client: { from: (table: string) => builder(table) } as unknown as SupabaseClient,
    rows
  };
}

/** The ledger double the real `StellarLedger` reads through. */
function ledgerSource(): HorizonAccountSource {
  return {
    loadAccount: (accountId: string) =>
      Promise.resolve({
        account_id: accountId,
        sequence: ACCOUNT_SEQUENCE,
        balances: [{ asset_type: "native", balance: "100.0000000" }]
      })
  };
}

interface HorizonScript {
  submit?: () => Promise<HorizonSubmitAsyncResponse>;
  load?: () => Promise<HorizonTransactionRecord>;
}

/**
 * A scriptable Horizon edge. The script is installed after the signed envelope
 * exists, because the transaction hash the lookup must return is the hash of the
 * envelope the submission actually carried.
 */
function scriptableHorizon(): {
  source: HorizonTransactionSource;
  script(next: HorizonScript): void;
  readonly submits: number;
  readonly loads: number;
} {
  const counters = { submits: 0, loads: 0 };
  let current: HorizonScript = {};

  return {
    source: {
      submitAsyncTransaction: () => {
        counters.submits += 1;
        return current.submit?.() ?? Promise.resolve({ hash: "", tx_status: "PENDING" });
      },
      loadTransaction: () => {
        counters.loads += 1;
        return (
          current.load?.() ?? Promise.reject(new NotFoundError("no scripted lookup", {}))
        );
      }
    },
    script: (next: HorizonScript) => {
      current = next;
    },
    get submits() {
      return counters.submits;
    },
    get loads() {
      return counters.loads;
    }
  };
}

interface Harness {
  readonly app: FastifyInstance;
  readonly rows: Map<string, Record<string, unknown>>;
  readonly xdr: StellarRevenueShareDistributionXdr;
  readonly horizon: ReturnType<typeof scriptableHorizon>;
  readonly scheduler: ConfirmationScheduler<ConfirmRevenueShareDistributionsResult>;
  advanceTo(now: string): void;
}

function harness(): Harness {
  const store = inMemoryDistributionStore();
  const repository = new SupabaseRevenueShareDistributionRepository(store.client);
  const xdr = new StellarRevenueShareDistributionXdr();
  const ledger = new StellarLedger(CONFIG, ledgerSource());
  const horizon = scriptableHorizon();
  const clock = { now: START };

  const scheduler = new ConfirmationScheduler(
    (input) =>
      confirmRevenueShareDistributions(
        { repository, transaction: new StellarTransaction(CONFIG, horizon.source) },
        input
      ),
    {
      policy: POLICY,
      now: () => clock.now,
      generateCorrelationId: () => CORRELATION_ID
    }
  );

  const app = buildApp({
    revenueShareDistribution: {
      ledger,
      xdr,
      repository,
      network: { network: "testnet", networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE },
      explorerBaseUrl: EXPLORER_BASE_URL,
      generateDistributionId: () => DISTRIBUTION_ID
    }
  });

  return {
    app,
    rows: store.rows,
    xdr,
    horizon,
    scheduler,
    advanceTo: (now: string) => {
      clock.now = now;
    }
  };
}

async function prepare(test: Harness): Promise<WirePrepared> {
  const response = await test.app.inject({
    method: "POST",
    url: "/revenue-share-distributions",
    payload: PREPARE_BODY
  });

  expect(response.statusCode).toBe(200);
  return response.json().distribution as WirePrepared;
}

/** The declared terms as the submit command carries them: a strict, 7-key object. */
function termsOf(prepared: WirePrepared): WireTerms {
  return {
    network: prepared.network,
    networkPassphrase: prepared.networkPassphrase,
    sourceAccountId: prepared.sourceAccountId,
    sourceSequence: prepared.sourceSequence,
    memo: prepared.memo,
    expiresAt: prepared.expiresAt,
    recipients: prepared.recipients
  };
}

/** Signs a real built envelope with a throwaway key and derives its real hash. */
function sign(unsignedXdr: string): { signedXdr: string; hash: string } {
  const transaction = TransactionBuilder.fromXDR(
    unsignedXdr,
    STELLAR_TESTNET_NETWORK_PASSPHRASE
  ) as Transaction;

  transaction.sign(sourceKeypair);

  return {
    signedXdr: transaction.toXDR(),
    // `hash()` is a byte array, not a Buffer: `toString("hex")` is ignored on it.
    hash: Buffer.from(transaction.hash()).toString("hex")
  };
}

async function submit(
  test: Harness,
  prepared: WirePrepared,
  signedXdr: string
): Promise<Awaited<ReturnType<FastifyInstance["inject"]>>> {
  return test.app.inject({
    method: "POST",
    url: `/revenue-share-distributions/${prepared.distributionId}/submission`,
    payload: { signedXdr, terms: termsOf(prepared), applicationId: null }
  });
}

/** Prepares, signs and submits over the real route, returning the real hash. */
async function submitOnce(test: Harness): Promise<string> {
  const prepared = await prepare(test);
  const signed = sign(prepared.xdr);
  const response = await submit(test, prepared, signed.signedXdr);

  expect(response.statusCode).toBe(202);
  return signed.hash;
}

async function readDistribution(app: FastifyInstance): Promise<Record<string, unknown>> {
  const response = await app.inject({
    method: "GET",
    url: `/revenue-share-distributions/${DISTRIBUTION_ID}`
  });

  expect(response.statusCode).toBe(200);
  return response.json().distribution as Record<string, unknown>;
}

function storedRecipients(row: Record<string, unknown> | undefined): unknown {
  return row?.["revenue_share_distribution_recipient"];
}

describe("revenue-share distribution sequence (real adapters, real use cases, real route)", () => {
  it("prepares an unsigned multi-payment envelope and persists nothing", async () => {
    const test = harness();

    const prepared = await prepare(test);

    // The envelope is real and unsigned: it decodes with the SDK and carries one
    // native payment per declared recipient, in the declared order.
    expect(prepared.distributionId).toBe(DISTRIBUTION_ID);
    expect(prepared.xdr.length).toBeGreaterThan(0);
    expect(prepared.sourceAccountId).toBe(SOURCE_ACCOUNT);
    expect(prepared.sourceSequence).toBe("1234567891");
    expect(prepared.recipients).toEqual([
      { accountId: FIRST_RECIPIENT, amountStroops: FIRST_AMOUNT },
      { accountId: SECOND_RECIPIENT, amountStroops: SECOND_AMOUNT }
    ]);

    // `prepare` is stateless (`D2`): nothing is written until a signed envelope
    // exists, so there is no pre-submission row to reconcile later.
    expect(test.rows.size).toBe(0);

    await test.app.close();
  });

  it("accepts a genuinely signed envelope, persists the parent and its recipients, and returns the snapshot", async () => {
    const test = harness();

    const prepared = await prepare(test);
    const signed = sign(prepared.xdr);
    const response = await submit(test, prepared, signed.signedXdr);

    expect(response.statusCode).toBe(202);

    const body = response.json();
    expect(body.applied).toBe(true);
    expect(body.distribution.state).toBe("submitted");
    expect(body.distribution.transactionHash).toBe(signed.hash);
    expect(body.distribution.explorerUrl).toBe(`${EXPLORER_BASE_URL}/tx/${signed.hash}`);
    expect(body.distribution.recipients).toEqual([
      { accountId: FIRST_RECIPIENT, amountStroops: FIRST_AMOUNT },
      { accountId: SECOND_RECIPIENT, amountStroops: SECOND_AMOUNT }
    ]);

    // The parent row and its recipient rows were committed together, with the
    // exact stroop values the envelope encoded — never a rounded JSON number.
    expect(test.rows.size).toBe(1);
    const row = test.rows.get(DISTRIBUTION_ID);
    expect(row?.state).toBe("submitted");
    expect(row?.confirmation_attempts).toBe(0);
    expect(row?.transaction_hash).toBe(signed.hash);
    expect(storedRecipients(row)).toEqual([
      { position: 0, account_id: FIRST_RECIPIENT, amount_stroops: FIRST_AMOUNT },
      { position: 1, account_id: SECOND_RECIPIENT, amount_stroops: SECOND_AMOUNT }
    ]);

    await test.app.close();
  });

  it("treats an exact replay of the same signed envelope as a non-application", async () => {
    const test = harness();

    const prepared = await prepare(test);
    const signed = sign(prepared.xdr);

    const first = await submit(test, prepared, signed.signedXdr);
    expect(first.statusCode).toBe(202);
    expect(first.json().applied).toBe(true);

    const replay = await submit(test, prepared, signed.signedXdr);

    // 200, not 202: the row already exists and is returned unchanged.
    expect(replay.statusCode).toBe(200);
    expect(replay.json().applied).toBe(false);
    expect(replay.json().distribution.state).toBe("submitted");

    // No duplicate parent and no duplicate recipient rows.
    expect(test.rows.size).toBe(1);
    expect(storedRecipients(test.rows.get(DISTRIBUTION_ID))).toHaveLength(2);

    await test.app.close();
  });

  it("refuses a signed envelope that does not match the declared amounts and persists nothing", async () => {
    const test = harness();

    const prepared = await prepare(test);
    const declared = termsOf(prepared);

    // A real envelope, correctly signed by the source, that pays a different
    // amount than the terms declare. The sequence is built from the ledger's own
    // sequence so the failure is the recipient list, not an incidental mismatch.
    const tampered = test.xdr.build({
      terms: {
        network: declared.network,
        networkPassphrase: declared.networkPassphrase,
        sourceAccountId: declared.sourceAccountId,
        sourceSequence: ACCOUNT_SEQUENCE,
        memo: declared.memo,
        expiresAt: declared.expiresAt,
        recipients: declared.recipients.map((recipient, index) => ({
          accountId: recipient.accountId,
          amountStroops: BigInt(recipient.amountStroops) + (index === 0 ? 1n : 0n)
        }))
      },
      maxTimeUnixSeconds: Math.floor(Date.parse(declared.expiresAt) / 1000)
    });

    if (!tampered.ok) {
      throw new Error("the harness failed to build a mismatching envelope");
    }

    const signed = sign(tampered.value.xdr);
    const response = await submit(test, prepared, signed.signedXdr);

    // 422, not 400: the body is well-formed and the envelope is semantically
    // refused. Nothing is written, so a refused envelope leaves no trace.
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "xdr_rejected" });
    expect(test.rows.size).toBe(0);

    await test.app.close();
  });

  it("drives submitted to confirmed when Horizon reports a successful transaction", async () => {
    const test = harness();
    const hash = await submitOnce(test);

    test.horizon.script({
      submit: () => Promise.resolve({ hash, tx_status: "PENDING" }),
      load: () =>
        Promise.resolve({
          hash,
          ledger_attr: INCLUDING_LEDGER,
          successful: true,
          created_at: LEDGER_CLOSED_AT
        })
    });

    await test.scheduler.runOnce();

    const distribution = await readDistribution(test.app);

    expect(distribution.state).toBe("confirmed");
    expect(distribution.failureReason).toBeNull();
    expect(distribution.explorerUrl).toBe(`${EXPLORER_BASE_URL}/tx/${hash}`);

    const row = test.rows.get(DISTRIBUTION_ID);
    expect(row?.state).toBe("confirmed");
    // Horizon's own evidence is what was persisted: its ledger and close time,
    // never a local clock reading.
    expect(row?.ledger_sequence).toBe(String(INCLUDING_LEDGER));
    expect(row?.confirmed_at).toBe(LEDGER_CLOSED_AT);

    await test.app.close();
  });

  it("drives submitted to failed with a sanitised reason when the network refuses the envelope", async () => {
    const test = harness();
    await submitOnce(test);

    test.horizon.script({
      submit: () =>
        Promise.reject(
          new TransactionFailedError("rejected", {
            data: { extras: { result_codes: { transaction: "tx_insufficient_fee" } } },
            status: 400,
            statusText: "Bad Request"
          })
        )
    });

    await test.scheduler.runOnce();

    const distribution = await readDistribution(test.app);

    expect(distribution.state).toBe("failed");
    // Horizon's own code never crosses the boundary; the closed vocabulary does.
    expect(distribution.failureReason).toBe("insufficient_fee");
    expect(JSON.stringify(distribution)).not.toContain("tx_insufficient_fee");

    const row = test.rows.get(DISTRIBUTION_ID);
    expect(row?.state).toBe("failed");
    expect(row?.failure_reason).toBe("insufficient_fee");
    // A rejection is terminal, so the poll never looked the transaction up.
    expect(test.horizon.loads).toBe(0);

    await test.app.close();
  });

  it("leaves the record submitted, never terminal, when the transaction port is unavailable", async () => {
    const test = harness();
    await submitOnce(test);

    test.horizon.script({
      submit: () => Promise.reject(new NetworkError("fetch failed", {}))
    });

    const result = await test.scheduler.runOnce();

    const distribution = await readDistribution(test.app);

    // The state does not move, because Vaqcrow does not know the outcome. The
    // schedule does, which is what makes the next run a resumption.
    expect(distribution.state).toBe("submitted");
    expect(distribution.failureReason).toBeNull();
    expect(result.ok).toBe(true);

    const row = test.rows.get(DISTRIBUTION_ID);
    expect(row?.state).toBe("submitted");
    expect(row?.failure_reason).toBeNull();
    expect(row?.confirmation_attempts).toBe(1);
    expect(row?.next_attempt_at).toBe("2026-09-21T12:00:05.000Z");

    // The next tick resumes from the persisted schedule rather than restarting,
    // and still concludes nothing: the state never moves without an outcome.
    test.advanceTo("2026-09-21T12:00:05.000Z");
    await test.scheduler.runOnce();

    const resumed = test.rows.get(DISTRIBUTION_ID);
    expect(resumed?.state).toBe("submitted");
    expect(resumed?.confirmation_attempts).toBe(2);
    expect(test.horizon.submits).toBe(2);

    await test.app.close();
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Account,
  Asset,
  Keypair,
  NetworkError,
  NotFoundError,
  Operation,
  TransactionBuilder,
  TransactionFailedError
} from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { generateCorrelationId, parseFundingIntentId } from "@vaqcrow/contracts";
import type { CorrelationId, FundingIntentId } from "@vaqcrow/contracts";
import type { ConfirmationPolicy } from "../../application/use-cases/confirm-funding-intents.js";
import type { FundingIntentSubmission } from "../../application/ports/funding-intent-repository-port.js";
import { StellarTransaction } from "../adapters/stellar-transaction.js";
import type {
  HorizonSubmitAsyncResponse,
  HorizonTransactionRecord,
  HorizonTransactionSource
} from "../adapters/stellar-transaction.js";
import { SupabaseFundingIntentRepository } from "../adapters/supabase-funding-intent-repository.js";
import { STELLAR_TESTNET_NETWORK_PASSPHRASE } from "../../application/config/stellar-config.js";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import { ConfirmationScheduler } from "../scheduling/confirmation-scheduler.js";
import { buildApp } from "./build-app.js";

/**
 * The confirmation capability observed end to end, with a double only at each
 * provider edge.
 *
 * Everything Vaqcrow wrote runs for real: the real `StellarTransaction` adapter,
 * the real `SupabaseFundingIntentRepository`, the real `confirmFundingIntents`
 * use case, the real `ConfirmationScheduler`, and the real HTTP route. The two
 * doubles sit at the boundaries Vaqcrow does not own — the Supabase client and
 * Horizon — which is the narrowest level at which a double can still be called
 * effective: anything wider would stop exercising the code this Feature added,
 * and anything narrower would mean re-implementing PostgREST.
 *
 * This is the gap #80 left. Its own suites prove each layer with the others
 * doubled: the use case against mock ports, the adapters against hand-written
 * responses, the route against a fake repository. None of them observes a
 * persisted intent being advanced by a poll and read back over HTTP, so none of
 * them would catch a disagreement *between* the layers — a payload the repository
 * cannot decode, a state the contract and the adapter spell differently, an
 * explorer link derived from the wrong hash. The four scenarios below are the
 * ones the Feature's own testing strategy names: success, failure, timeout and
 * resume.
 */

const CONFIG: StellarConfig = {
  network: "testnet",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
  explorerUrl: "https://stellar.expert/explorer/testnet"
};

const INTENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as FundingIntentId;
const CORRELATION_ID = generateCorrelationId();
const LEDGER_SEQUENCE = 1234567;
const LEDGER_CLOSED_AT = "2026-09-21T12:00:04.000Z";
const START = "2026-09-21T12:00:00.000Z";
const STILL_VALID = "2026-09-21T12:15:00.000Z";
const ALREADY_EXPIRED = "2026-09-21T11:59:59.000Z";

/**
 * A real signed envelope, because the adapter decodes it for real.
 *
 * The first version of this harness seeded a placeholder string, and every
 * scenario that expected a submission came back `failed` / `unsuccessful`: the
 * adapter could not decode it and correctly reported `invalid_input`. The adapter
 * was right and the fixture was wrong, which is exactly the kind of thing a
 * suite that runs the real decoder is supposed to surface.
 *
 * The hash is derived from the envelope rather than invented, so the lookup the
 * poll performs is for the transaction the submission actually carried.
 */
const sourceKeypair = Keypair.random();
const destinationKeypair = Keypair.random();

function buildSignedEnvelope(): { xdr: string; hash: string; source: string; destination: string } {
  const account = new Account(sourceKeypair.publicKey(), "1099511627778");
  const transaction: Transaction = new TransactionBuilder(account, {
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

  return {
    xdr: transaction.toXDR(),
    // `hash()` is a byte array, not a Buffer: `toString("hex")` is ignored on it.
    hash: Buffer.from(transaction.hash()).toString("hex"),
    source: sourceKeypair.publicKey(),
    destination: destinationKeypair.publicKey()
  };
}

const ENVELOPE = buildSignedEnvelope();
const TRANSACTION_HASH = ENVELOPE.hash;

const POLICY: ConfirmationPolicy = {
  batchSize: 5,
  initialBackoffMs: 5_000,
  maxBackoffMs: 60_000
};

/**
 * A stateful stand-in for PostgREST over `funding_intent`.
 *
 * It reproduces the two server-side behaviours the adapter relies on and cannot
 * provide itself: the column defaults a fresh row receives, and the conditional
 * update that matches on `state` as well as on `intent_id`. That mirroring is a
 * real risk — a divergence from the migration would let this suite pass while
 * production failed — which is why the live integration suite asserts the real
 * columns and constraints exist. The mirror is verified from the other side
 * rather than trusted.
 */
function inMemorySupabase(): { client: SupabaseClient; rows: Map<string, Record<string, unknown>> } {
  const rows = new Map<string, Record<string, unknown>>();

  type Terminal = "single" | "maybeSingle" | "list";

  function builder(table: string) {
    let op: "insert" | "select" | "update" = "select";
    let payload: Record<string, unknown> | undefined;
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    const eqFilters: Array<readonly [string, unknown]> = [];
    let orderBy: string | undefined;
    let limitTo: number | undefined;
    let terminal: Terminal = "list";

    const matches = (row: Record<string, unknown>): boolean =>
      filters.every((filter) => filter(row)) &&
      eqFilters.every(([column, value]) => row[column] === value);

    function run(): { data: unknown; error: { code: string; message: string } | null } {
      if (table !== "funding_intent") {
        return { data: null, error: { code: "42P01", message: "unknown table" } };
      }

      if (op === "insert" && payload !== undefined) {
        const intentId = payload["intent_id"] as string;

        if (rows.has(intentId)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }

        // The defaults the migration declares, plus the `updated_at` trigger.
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

        rows.set(intentId, stored);
        return { data: stored, error: null };
      }

      if (op === "update" && payload !== undefined) {
        // The conditional half lives here: a transition only touches a row that
        // is still `submitted`, which is what makes a replay a non-application.
        const target = [...rows.values()].find(matches);

        if (target === undefined) {
          return { data: null, error: null };
        }

        Object.assign(target, payload, { updated_at: START });
        return { data: target, error: null };
      }

      let selected = [...rows.values()].filter(matches);

      if (orderBy !== undefined) {
        selected = selected.sort((left, right) =>
          String(left[orderBy as string]).localeCompare(String(right[orderBy as string]))
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
        filters.push((row) => String(row[column]) <= String(value));
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
      then: (onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) => {
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

function horizonSource(script: {
  submit?: () => Promise<HorizonSubmitAsyncResponse>;
  load?: () => Promise<HorizonTransactionRecord>;
}): { source: HorizonTransactionSource; submits: number; loads: number } {
  const counters = { submits: 0, loads: 0 };

  return {
    source: {
      submitAsyncTransaction: () => {
        counters.submits += 1;
        return script.submit?.() ?? Promise.resolve({ hash: TRANSACTION_HASH, tx_status: "PENDING" });
      },
      loadTransaction: () => {
        counters.loads += 1;
        return script.load?.() ?? Promise.reject(new NetworkError("no scripted lookup", {}));
      }
    },
    get submits() {
      return counters.submits;
    },
    get loads() {
      return counters.loads;
    }
  };
}

function submission(overrides: Partial<FundingIntentSubmission> = {}): FundingIntentSubmission {
  return {
    intentId: INTENT_ID,
    network: "testnet",
    networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
    sourceAccountId: ENVELOPE.source,
    sourceSequence: "1099511627778",
    destinationAccountId: ENVELOPE.destination,
    amountStroops: 10_000_000n,
    expiresAt: STILL_VALID,
    signedXdr: ENVELOPE.xdr,
    transactionHash: TRANSACTION_HASH,
    ...overrides
  };
}

interface Harness {
  readonly app: FastifyInstance;
  readonly rows: Map<string, Record<string, unknown>>;
  readonly horizon: ReturnType<typeof horizonSource>;
  readonly scheduler: ConfirmationScheduler;
  /** Moves the injected clock, so a step can be run when its schedule is due. */
  advanceTo(now: string): void;
}

async function harness(options: {
  script?: Parameters<typeof horizonSource>[0];
  expiresAt?: string;
  now?: string;
} = {}): Promise<Harness> {
  const store = inMemorySupabase();
  const repository = new SupabaseFundingIntentRepository(store.client);
  const horizon = horizonSource(options.script ?? {});

  const seeded = await repository.submit({
    record: submission({ expiresAt: options.expiresAt ?? STILL_VALID }),
    correlationId: CORRELATION_ID
  });

  if (!seeded.ok) {
    throw new Error("the harness failed to seed a submitted intent");
  }

  const state = { now: options.now ?? START };

  const scheduler = new ConfirmationScheduler(
    {
      repository,
      transaction: new StellarTransaction(CONFIG, horizon.source)
    },
    {
      policy: POLICY,
      now: () => state.now,
      generateCorrelationId: () => CORRELATION_ID as CorrelationId
    }
  );

  const app = buildApp({
    fundingIntent: {
      // Only the status read is exercised here, so the ledger and the XDR port are
      // inert: reaching them would mean this suite had drifted into another path.
      ledger: { getAccount: () => Promise.reject(new Error("the confirmation path must not read an account")) },
      xdr: {
        build: () => {
          throw new Error("the confirmation path must not build an envelope");
        },
        verify: () => {
          throw new Error("the confirmation path must not verify an envelope");
        }
      },
      repository,
      network: { network: "testnet", networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE },
      explorerBaseUrl: CONFIG.explorerUrl,
      generateIntentId: () => parseFundingIntentId(generateCorrelationId())
    }
  });

  return {
    app,
    rows: store.rows,
    horizon,
    scheduler,
    advanceTo: (now: string) => {
      state.now = now;
    }
  };
}

async function readIntent(app: FastifyInstance): Promise<Record<string, unknown>> {
  const response = await app.inject({ method: "GET", url: `/funding-intents/${INTENT_ID}` });

  expect(response.statusCode).toBe(200);
  return response.json().intent as Record<string, unknown>;
}

describe("confirmation sequence (real adapters, real use case, real route)", () => {
  it("advances a persisted intent to confirmed and reports Horizon's evidence over HTTP", async () => {
    const test = await harness({
      script: {
        submit: () => Promise.resolve({ hash: TRANSACTION_HASH, tx_status: "PENDING" }),
        load: () =>
          Promise.resolve({
            hash: TRANSACTION_HASH,
            ledger_attr: LEDGER_SEQUENCE,
            successful: true,
            created_at: LEDGER_CLOSED_AT
          })
      }
    });

    await test.scheduler.runOnce();

    const intent = await readIntent(test.app);

    expect(intent.state).toBe("confirmed");
    // The two fields the third acceptance criterion names, end to end: the reason
    // is absent because the intent did not fail, and the link is derived from the
    // hash the adapter actually persisted.
    expect(intent.failureReason).toBeNull();
    expect(intent.explorerUrl).toBe(`${CONFIG.explorerUrl}/tx/${TRANSACTION_HASH}`);
    expect(intent.transactionHash).toBe(TRANSACTION_HASH);
    // The persisted row agrees with what the route reported.
    expect(test.rows.get(INTENT_ID)?.state).toBe("confirmed");

    await test.app.close();
  });

  it("fails an intent whose submission the network refused, with a mapped reason", async () => {
    const test = await harness({
      script: {
        submit: () =>
          Promise.reject(
            new TransactionFailedError("rejected", {
              data: { extras: { result_codes: { transaction: "tx_insufficient_fee" } } },
              status: 400,
              statusText: "Bad Request"
            })
          )
      }
    });

    await test.scheduler.runOnce();

    const intent = await readIntent(test.app);

    expect(intent.state).toBe("failed");
    // Horizon's own code never crosses the boundary; the closed vocabulary does.
    expect(intent.failureReason).toBe("insufficient_fee");
    expect(JSON.stringify(intent)).not.toContain("tx_insufficient_fee");
    // A rejection is terminal, so the poll never looked the transaction up.
    expect(test.horizon.loads).toBe(0);

    await test.app.close();
  });

  it("survives an unreachable Horizon without concluding anything", async () => {
    const test = await harness({
      script: { submit: () => Promise.reject(new NetworkError("fetch failed", {})) }
    });

    const result = await test.scheduler.runOnce();

    const intent = await readIntent(test.app);

    // The state does not move, because Vaqcrow does not know the outcome. The
    // schedule does, which is what makes the next step a resumption.
    expect(intent.state).toBe("submitted");
    expect(intent.failureReason).toBeNull();
    expect(test.rows.get(INTENT_ID)?.confirmation_attempts).toBe(1);
    expect(result.ok).toBe(true);

    await test.app.close();
  });

  it("keeps polling with a widening interval while the network has not decided", async () => {
    const test = await harness({
      script: {
        submit: () => Promise.resolve({ hash: TRANSACTION_HASH, tx_status: "PENDING" }),
        // Horizon serves its lookup from ingested history, so a transaction that
        // has not reached a ledger is absent rather than unsuccessful.
        load: () => Promise.reject(new NotFoundError("not found", { status: 404, statusText: "Not Found" }))
      }
    });

    await test.scheduler.runOnce();
    const row = test.rows.get(INTENT_ID);
    expect(row?.confirmation_attempts).toBe(1);
    expect(row?.next_attempt_at).toBe("2026-09-21T12:00:05.000Z");

    // A step before the schedule is due must find nothing. That is what keeps the
    // poll from hammering Horizon, and it is the half of "bounded" that a test
    // asserting only the final count would miss.
    await test.scheduler.runOnce();
    expect(test.rows.get(INTENT_ID)?.confirmation_attempts).toBe(1);

    test.advanceTo("2026-09-21T12:00:05.000Z");
    await test.scheduler.runOnce();

    test.advanceTo("2026-09-21T12:00:15.000Z");
    await test.scheduler.runOnce();

    const finalRow = test.rows.get(INTENT_ID);

    expect(finalRow?.state).toBe("submitted");
    expect(finalRow?.confirmation_attempts).toBe(3);
    // 5s, then 10s, then 20s: the interval widens, so the load does not grow with
    // the attempt count.
    expect(finalRow?.next_attempt_at).toBe("2026-09-21T12:00:35.000Z");

    await test.app.close();
  });

  it("fails an expired envelope terminally without touching the network", async () => {
    const test = await harness({ expiresAt: ALREADY_EXPIRED });

    await test.scheduler.runOnce();

    const intent = await readIntent(test.app);

    // The envelope's own maxTime is the bound (D3), decided locally: after it
    // Stellar can never include the transaction, so there is nothing to ask.
    expect(intent.state).toBe("failed");
    expect(intent.failureReason).toBe("expired");
    expect(test.horizon.submits).toBe(0);
    expect(test.horizon.loads).toBe(0);

    await test.app.close();
  });

  it("resumes from the persisted schedule after a restart, rather than restarting", async () => {
    const store = inMemorySupabase();
    const repository = new SupabaseFundingIntentRepository(store.client);

    const seeded = await repository.submit({ record: submission(), correlationId: CORRELATION_ID });
    expect(seeded.ok).toBe(true);

    const clock = { now: START };

    function schedulerOver(sameStore: SupabaseClient, script: Parameters<typeof horizonSource>[0]) {
      const horizon = horizonSource(script);

      return {
        horizon,
        scheduler: new ConfirmationScheduler(
          { repository: new SupabaseFundingIntentRepository(sameStore), transaction: new StellarTransaction(CONFIG, horizon.source) },
          {
            policy: POLICY,
            now: () => clock.now,
            generateCorrelationId: () => CORRELATION_ID as CorrelationId
          }
        )
      };
    }

    // First process: Horizon is unreachable, so the intent is deferred.
    const first = schedulerOver(store.client, {
      submit: () => Promise.reject(new NetworkError("fetch failed", {}))
    });

    await first.scheduler.runOnce();
    expect(store.rows.get(INTENT_ID)?.confirmation_attempts).toBe(1);

    // A different process, with its own repository, adapter and scheduler — and
    // no shared in-memory state beyond the database itself.
    clock.now = "2026-09-21T12:00:05.000Z";

    const second = schedulerOver(store.client, {
      submit: () => Promise.resolve({ hash: TRANSACTION_HASH, tx_status: "PENDING" }),
      load: () =>
        Promise.resolve({
          hash: TRANSACTION_HASH,
          ledger_attr: LEDGER_SEQUENCE,
          successful: true,
          created_at: LEDGER_CLOSED_AT
        })
    });

    await second.scheduler.runOnce();

    const row = store.rows.get(INTENT_ID);

    // It continued from the persisted count rather than from one, and it reached
    // a terminal state: the resumption is the point, not the restart.
    expect(row?.confirmation_attempts).toBe(1);
    expect(row?.state).toBe("confirmed");
    expect(second.horizon.loads).toBe(1);
  });
});

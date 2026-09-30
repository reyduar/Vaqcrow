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
import {
  generateCorrelationId,
  parseApplicationId,
  parseRevenueShareDistributionId
} from "@vaqcrow/contracts";
import type { CorrelationId, SalesPeriodContract } from "@vaqcrow/contracts";
import { STELLAR_TESTNET_NETWORK_PASSPHRASE } from "../../application/config/stellar-config.js";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import { deriveRevenueShareDistribution } from "../../application/use-cases/derive-revenue-share-distribution.js";
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

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";

/**
 * The case the server derives from (T5a): a settled campaign funded 75 % / 25 %
 * by the two recipients, an approved limit of 5,000,000 ARS, and the canonical
 * 2026-08 sales period. 3,745,800 ARS x 450 bps floor = 168,561 ARS, converted
 * in the funded proportion: floor(168,561 x 1,000,000,000 / 5,000,000) =
 * 33,712,200 stroops, split 25,284,150 / 8,428,050 — exact integers, no floats.
 */
const GOAL_STROOPS = 1_000_000_000n;
const FIRST_AMOUNT_STROOPS = 25_284_150n;
const SECOND_AMOUNT_STROOPS = 8_428_050n;
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

/** No recipients: the server derives them from the case. */
const PREPARE_BODY = {
  sourceAccountId: SOURCE_ACCOUNT,
  applicationId: APPLICATION_ID,
  campaignId: CAMPAIGN_ID,
  memo: null
};

const SALES: readonly SalesPeriodContract[] = [
  { period: "2026-04", amountArs: null, status: "missing", evidenceRef: "sales:2026-04", simuladoLabel: "SIMULADO" },
  { period: "2026-07", amountArs: 3_690_300, status: "reported", evidenceRef: "sales:2026-07", simuladoLabel: "SIMULADO" },
  { period: "2026-08", amountArs: 3_745_800, status: "reported", evidenceRef: "sales:2026-08", simuladoLabel: "SIMULADO" }
];

const CAMPAIGN_MIRROR = {
  campaignId: CAMPAIGN_ID,
  applicationId: APPLICATION_ID,
  smeAccountId: SOURCE_ACCOUNT,
  contractAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  network: "testnet",
  tokenContractAddress: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF",
  goalStroops: GOAL_STROOPS,
  deadline: "2026-12-01T00:00:00.000Z",
  state: "settled" as const,
  totalStroops: GOAL_STROOPS,
  reconciliationStatus: "in_sync" as const,
  lastReconciledAt: START,
  createdAt: START,
  updatedAt: START
};

/** Port doubles at the edge of the derivation: the case itself, read as the API reads it. */
function derivationDeps(): Parameters<typeof deriveRevenueShareDistribution>[0] {
  return {
    campaigns: {
      findById: () => Promise.resolve({ ok: true as const, value: CAMPAIGN_MIRROR }),
      // The mirror and the chain agree the vault settled; the reconcile write is
      // a no-op here, the campaign persistence has its own suites.
      reconcile: () => Promise.resolve({ ok: true as const, value: { campaign: CAMPAIGN_MIRROR, applied: true } }),
      findContributions: () =>
        Promise.resolve({
          ok: true as const,
          value: [
            { campaignId: CAMPAIGN_ID, investorAccountId: FIRST_RECIPIENT, amountStroops: 750_000_000n, lastObservedAt: START },
            { campaignId: CAMPAIGN_ID, investorAccountId: SECOND_RECIPIENT, amountStroops: 250_000_000n, lastObservedAt: START }
          ]
        })
    },
    chain: {
      readCampaign: () =>
        Promise.resolve({
          ok: true as const,
          value: {
            state: "settled" as const,
            totalStroops: GOAL_STROOPS,
            goalStroops: GOAL_STROOPS,
            deadline: new Date(CAMPAIGN_MIRROR.deadline),
            smeAccountId: SOURCE_ACCOUNT,
            tokenContractId: CAMPAIGN_MIRROR.tokenContractAddress,
            observedAt: new Date(START)
          }
        })
    },
    applicationReviews: {
      readLatestHumanDecision: () =>
        Promise.resolve({
          ok: true as const,
          value: {
            decisionId: "44444444-4444-4444-8444-444444444444",
            applicationId: APPLICATION_ID,
            outcome: "approved",
            actor: "analyst",
            reason: "Looks sound",
            approvedLimitArs: 5_000_000,
            decidedAt: START,
            correlationId: CORRELATION_ID
          } as never
        })
    },
    smeRequests: {
      findByApplicationId: () =>
        Promise.resolve({
          ok: true as const,
          value: {
            applicationId: APPLICATION_ID,
            request: {
              smeReference: "sme:SYN-PH-0001",
              declaredTotalArs: 15_000_000,
              periodStart: "2026-01",
              periodEnd: "2026-08",
              simuladoLabel: "SIMULADO" as const
            }
          }
        })
    },
    salesData: { getPeriods: () => Promise.resolve({ ok: true as const, value: SALES }) }
  };
}

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
  readonly applicationId: string;
  readonly campaignId: string;
  readonly derivation: { readonly obligationArs: string; readonly period: string };
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
    const neqFilters: Array<readonly [string, unknown]> = [];
    let dueByOrBefore: string | undefined;
    let orderBy: string | undefined;
    let limitTo: number | undefined;
    let terminal: Terminal = "list";

    const matches = (row: Record<string, unknown>): boolean =>
      eqFilters.every(([column, value]) => row[column] === value) &&
      neqFilters.every(([column, value]) => row[column] !== value) &&
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

        // The partial unique index the migration declares: one non-failed
        // distribution per (campaign_id, period), nulls excluded.
        const periodClash =
          payload["campaign_id"] != null &&
          payload["period"] != null &&
          [...rows.values()].some(
            (row) =>
              row["state"] !== "failed" &&
              row["campaign_id"] === payload?.["campaign_id"] &&
              row["period"] === payload?.["period"]
          );

        if (periodClash) {
          return {
            data: null,
            error: {
              code: "23505",
              message: 'duplicate key value violates unique constraint "revenue_share_distribution_campaign_period_key"'
            }
          };
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
      neq: (column: string, value: unknown) => {
        neqFilters.push([column, value]);
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
      derive: (input) => deriveRevenueShareDistribution(derivationDeps(), input),
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
    payload: {
      signedXdr,
      terms: termsOf(prepared),
      applicationId: prepared.applicationId,
      campaignId: prepared.campaignId
    }
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

    // The amounts were derived by the server from the case, not supplied: the
    // canonical 168,561 ARS obligation, converted in the funded proportion.
    expect(prepared.derivation.period).toBe("2026-08");
    expect(prepared.derivation.obligationArs).toBe("168561");
    expect(prepared.campaignId).toBe(CAMPAIGN_ID);

    // `prepare` is stateless (`D2`): nothing is written until a signed envelope
    // exists, so there is no pre-submission row to reconcile later.
    expect(test.rows.size).toBe(0);

    await test.app.close();
  });

  it("distributes a campaign's period once: a second submission is refused, a failed one frees the slot", async () => {
    const test = harness();

    const first = await prepare(test);
    // A second envelope for the same case, prepared before the first is
    // submitted (prepare is stateless), differs by memo and so by hash.
    const secondResponse = await test.app.inject({
      method: "POST",
      url: "/revenue-share-distributions",
      payload: { ...PREPARE_BODY, memo: "retry" }
    });
    expect(secondResponse.statusCode).toBe(200);
    const second = secondResponse.json().distribution as WirePrepared;

    expect((await submit(test, first, sign(first.xdr).signedXdr)).statusCode).toBe(202);
    expect(test.rows.get(DISTRIBUTION_ID)?.period).toBe("2026-08");

    // The unique index (period) refuses the second live distribution, typed.
    const OTHER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const refused = await test.app.inject({
      method: "POST",
      url: `/revenue-share-distributions/${OTHER_ID}/submission`,
      payload: {
        signedXdr: sign(second.xdr).signedXdr,
        terms: termsOf(second),
        applicationId: second.applicationId,
        campaignId: second.campaignId
      }
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({ code: "already_distributed" });
    expect(test.rows.size).toBe(1);

    // Prepare refuses early, before anyone is asked to sign.
    const again = await test.app.inject({ method: "POST", url: "/revenue-share-distributions", payload: PREPARE_BODY });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ code: "already_distributed" });

    // A failed distribution frees the slot: a retry prepares again.
    const stored = test.rows.get(DISTRIBUTION_ID);
    if (stored === undefined) throw new Error("expected the first distribution to be stored");
    stored["state"] = "failed";
    stored["failure_reason"] = "tx_failed";

    const retry = await test.app.inject({ method: "POST", url: "/revenue-share-distributions", payload: PREPARE_BODY });
    expect(retry.statusCode).toBe(200);

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
    // The case the distribution was derived from is persisted with it.
    expect(row?.campaign_id).toBe(CAMPAIGN_ID);
    expect(row?.application_id).toBe(APPLICATION_ID);
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

  it("refuses a correctly signed envelope whose declared split is not the one the case derives, persisting nothing", async () => {
    const test = harness();

    const prepared = await prepare(test);
    const declared = termsOf(prepared);

    // A client that skips the derivation: it builds and signs a real envelope
    // that pays one investor more, and declares exactly those terms. The
    // envelope matches its own terms, so only the re-derivation can refuse it.
    const inflated = {
      ...declared,
      recipients: declared.recipients.map((recipient, index) => ({
        accountId: recipient.accountId,
        amountStroops: (BigInt(recipient.amountStroops) + (index === 0 ? 1n : 0n)).toString()
      }))
    };
    const built = test.xdr.build({
      terms: {
        ...inflated,
        sourceSequence: ACCOUNT_SEQUENCE,
        recipients: inflated.recipients.map((recipient) => ({
          accountId: recipient.accountId,
          amountStroops: BigInt(recipient.amountStroops)
        }))
      },
      maxTimeUnixSeconds: Math.floor(Date.parse(declared.expiresAt) / 1000)
    });

    if (!built.ok) {
      throw new Error("the harness failed to build the inflated envelope");
    }

    const signed = sign(built.value.xdr);
    const response = await test.app.inject({
      method: "POST",
      url: `/revenue-share-distributions/${prepared.distributionId}/submission`,
      payload: {
        signedXdr: signed.signedXdr,
        terms: { ...inflated, sourceSequence: built.value.sourceSequence },
        applicationId: prepared.applicationId,
        campaignId: prepared.campaignId
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "derivation_mismatch" });
    expect(test.rows.size).toBe(0);

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

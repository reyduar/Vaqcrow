import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { parseCorrelationId } from "@vaqcrow/contracts";
import type { DistributionRecipient } from "@vaqcrow/contracts";
import type {
  RevenueShareDistributionRecord,
  RevenueShareDistributionSubmission
} from "../../application/ports/revenue-share-distribution-repository-port.js";
import { SupabaseRevenueShareDistributionRepository } from "./supabase-revenue-share-distribution-repository.js";

const DISTRIBUTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_DISTRIBUTION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
const PERIOD = "2026-08";
const PERIOD_INDEX = "revenue_share_distribution_campaign_period_key";
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const ORIGINAL_CORRELATION_ID = parseCorrelationId("33333333-3333-4333-8333-333333333333");
const CREATED_AT = "2026-09-20T12:00:00.000Z";
const UPDATED_AT = "2026-09-20T12:00:01.000Z";
const NEXT_ATTEMPT_AT = "2026-09-20T12:00:30.000Z";
const CONFIRMED_AT = "2026-09-20T12:00:45.000Z";
const LEDGER_SEQUENCE = "1234567";
const TRANSACTION_HASH = "a".repeat(64);
const OTHER_TRANSACTION_HASH = "b".repeat(64);

// Hand-written but valid Stellar account addresses (`^G[A-Z2-7]{55}$`), so the
// recipient rows survive the S1 contract parser on read without a network read.
const SOURCE_ACCOUNT_ID = `G${"C".repeat(55)}`;
const FIRST_RECIPIENT_ACCOUNT = `G${"A".repeat(55)}`;
const SECOND_RECIPIENT_ACCOUNT = `G${"B".repeat(55)}`;

const FIRST_RECIPIENT: DistributionRecipient = {
  accountId: FIRST_RECIPIENT_ACCOUNT,
  amountStroops: 10_000_000n
};
const SECOND_RECIPIENT: DistributionRecipient = {
  accountId: SECOND_RECIPIENT_ACCOUNT,
  amountStroops: 2_500_000n
};
const RECIPIENTS: readonly DistributionRecipient[] = [FIRST_RECIPIENT, SECOND_RECIPIENT];

/** The required facts, before the two optional ones are layered on. */
const SUBMISSION_BASE: Omit<RevenueShareDistributionSubmission, "memo" | "applicationId" | "campaignId" | "period"> = {
  distributionId: DISTRIBUTION_ID,
  network: "testnet",
  networkPassphrase: "Test SDF Network ; September 2015",
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1099511627778",
  expiresAt: "2026-09-20T12:15:00.000Z",
  signedXdr: "AAAAAgAAAABsynthetic-signed-envelope",
  transactionHash: TRANSACTION_HASH,
  recipients: RECIPIENTS
};

const SUBMISSION: RevenueShareDistributionSubmission = {
  ...SUBMISSION_BASE,
  memo: "synthetic-memo",
  applicationId: APPLICATION_ID,
  campaignId: CAMPAIGN_ID,
  period: PERIOD
};

const EXPECTED_RECORD: RevenueShareDistributionRecord = {
  ...SUBMISSION,
  state: "submitted",
  // Server-owned scheduling facts. The insert does not send them — the column
  // defaults apply — but every read decodes them, so the expected record carries
  // them.
  confirmationAttempts: 0,
  nextAttemptAt: NEXT_ATTEMPT_AT,
  lastCorrelationId: CORRELATION_ID,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT
};

interface FakePostgrestError {
  readonly code: string;
  readonly message: string;
  readonly details: string;
  readonly hint: string;
}

type FakeStep = { readonly data: unknown; readonly error: FakePostgrestError | null } | { readonly reject: Error };

function fakeError(code: string): FakePostgrestError {
  return {
    code,
    message: `simulated message for ${code}`,
    details: `simulated details for ${code}`,
    hint: `simulated hint for ${code}`
  };
}

/** Arguments captured from calls the adapter makes on the fake query builder. */
interface RecordedCalls {
  readonly insert: unknown[];
  readonly update: unknown[];
  readonly eq: Array<readonly [column: string, value: unknown]>;
  readonly neq: Array<readonly [column: string, value: unknown]>;
  readonly lte: Array<readonly [column: string, value: unknown]>;
  readonly order: Array<readonly [column: string, value: unknown]>;
  readonly limit: number[];
}

/**
 * Hand-written fake matching the adapter's narrow supabase-js query surface:
 * `.from(table).insert(payload).select().single()`,
 * `.from(table).select().eq(...).maybeSingle()`,
 * `.from(table).update(payload).eq(...).eq(...).select().maybeSingle()` and the
 * list read `.from(table).select().eq(...).lte(...).order(...).limit(...)`. The
 * builder is thenable so a bare `.select()` chain can be awaited directly.
 *
 * Each terminal step (`.single()`, `.maybeSingle()`, or awaiting the builder)
 * consumes the next scripted `FakeStep` in order, so a test scripts exactly the
 * sequence of round trips the adapter is expected to make. `insert`/`update`/`eq`
 * arguments are recorded so assertions cover the payload the adapter sent, not
 * just the response it received.
 */
function createFakeSupabaseClient(steps: readonly FakeStep[]): {
  client: SupabaseClient;
  calls: RecordedCalls;
} {
  let cursor = 0;
  const calls: RecordedCalls = { insert: [], update: [], eq: [], neq: [], lte: [], order: [], limit: [] };

  function nextResult(): Promise<{ data: unknown; error: FakePostgrestError | null }> {
    const step = steps[cursor++];
    if (!step) {
      throw new Error(`createFakeSupabaseClient: no scripted response for call #${cursor}`);
    }
    if ("reject" in step) {
      return Promise.reject(step.reject);
    }
    return Promise.resolve(step);
  }

  function builder(): unknown {
    const self = {
      insert: (payload: unknown) => {
        calls.insert.push(payload);
        return self;
      },
      update: (payload: unknown) => {
        calls.update.push(payload);
        return self;
      },
      select: () => self,
      eq: (column: string, value: unknown) => {
        calls.eq.push([column, value]);
        return self;
      },
      neq: (column: string, value: unknown) => {
        calls.neq.push([column, value]);
        return self;
      },
      lte: (column: string, value: unknown) => {
        calls.lte.push([column, value]);
        return self;
      },
      order: (column: string, options: unknown) => {
        calls.order.push([column, options]);
        return self;
      },
      limit: (count: number) => {
        calls.limit.push(count);
        return self;
      },
      single: () => nextResult(),
      maybeSingle: () => nextResult(),
      then: (onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) =>
        nextResult().then(onFulfilled, onRejected)
    };
    return self;
  }

  return {
    client: { from: () => builder() } as unknown as SupabaseClient,
    calls
  };
}

function recipientRows(
  rows: ReadonlyArray<Readonly<Record<string, unknown>>> = [
    { position: 0, account_id: FIRST_RECIPIENT_ACCOUNT, amount_stroops: "10000000" },
    { position: 1, account_id: SECOND_RECIPIENT_ACCOUNT, amount_stroops: "2500000" }
  ]
): ReadonlyArray<Readonly<Record<string, unknown>>> {
  return rows;
}

function persistedRow(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    distribution_id: DISTRIBUTION_ID,
    state: "submitted",
    network: SUBMISSION.network,
    network_passphrase: SUBMISSION.networkPassphrase,
    source_account_id: SUBMISSION.sourceAccountId,
    source_sequence: SUBMISSION.sourceSequence,
    memo: SUBMISSION.memo,
    expires_at: SUBMISSION.expiresAt,
    signed_xdr: SUBMISSION.signedXdr,
    transaction_hash: SUBMISSION.transactionHash,
    application_id: SUBMISSION.applicationId,
    campaign_id: SUBMISSION.campaignId,
    period: SUBMISSION.period,
    failure_reason: null,
    confirmation_attempts: 0,
    next_attempt_at: NEXT_ATTEMPT_AT,
    confirmed_at: null,
    ledger_sequence: null,
    last_correlation_id: CORRELATION_ID,
    created_at: CREATED_AT,
    updated_at: UPDATED_AT,
    revenue_share_distribution_recipient: recipientRows(),
    ...overrides
  };
}

describe("SupabaseRevenueShareDistributionRepository", () => {
  describe("submit", () => {
    it("inserts the parent and its recipients atomically and reports applied: true", async () => {
      const { client, calls } = createFakeSupabaseClient([{ data: persistedRow(), error: null }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.submit({ record: SUBMISSION, correlationId: CORRELATION_ID });

      expect(result).toEqual({ ok: true, value: { record: EXPECTED_RECORD, applied: true } });
      // The state and the correlation id are server-owned; the amounts leave as
      // lossless decimal strings; the recipient rows ride along in the same
      // insert so PostgREST commits parent and children in one transaction.
      expect(calls.insert).toEqual([
        {
          distribution_id: DISTRIBUTION_ID,
          state: "submitted",
          network: SUBMISSION.network,
          network_passphrase: SUBMISSION.networkPassphrase,
          source_account_id: SUBMISSION.sourceAccountId,
          source_sequence: SUBMISSION.sourceSequence,
          memo: SUBMISSION.memo,
          expires_at: SUBMISSION.expiresAt,
          signed_xdr: SUBMISSION.signedXdr,
          transaction_hash: TRANSACTION_HASH,
          application_id: APPLICATION_ID,
          campaign_id: CAMPAIGN_ID,
          period: PERIOD,
          last_correlation_id: CORRELATION_ID,
          revenue_share_distribution_recipient: [
            { position: 0, account_id: FIRST_RECIPIENT_ACCOUNT, amount_stroops: "10000000" },
            { position: 1, account_id: SECOND_RECIPIENT_ACCOUNT, amount_stroops: "2500000" }
          ]
        }
      ]);
    });

    it("returns recipients in position order even when the embedded rows arrive shuffled", async () => {
      const { client } = createFakeSupabaseClient([
        {
          data: persistedRow({
            revenue_share_distribution_recipient: recipientRows([
              { position: 1, account_id: SECOND_RECIPIENT_ACCOUNT, amount_stroops: "2500000" },
              { position: 0, account_id: FIRST_RECIPIENT_ACCOUNT, amount_stroops: "10000000" }
            ])
          }),
          error: null
        }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.submit({ record: SUBMISSION, correlationId: CORRELATION_ID });

      if (!result.ok) {
        throw new Error("expected the submission to be applied");
      }
      expect(result.value.record.recipients).toEqual([FIRST_RECIPIENT, SECOND_RECIPIENT]);
    });

    it("omits memo, application id and campaign id when the distribution carries neither", async () => {
      const { client, calls } = createFakeSupabaseClient([
        { data: persistedRow({ memo: null, application_id: null, campaign_id: null, period: null }), error: null }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.submit({ record: SUBMISSION_BASE, correlationId: CORRELATION_ID });

      if (!result.ok) {
        throw new Error("expected the submission to be applied");
      }
      expect(calls.insert).toEqual([
        {
          distribution_id: DISTRIBUTION_ID,
          state: "submitted",
          network: SUBMISSION.network,
          network_passphrase: SUBMISSION.networkPassphrase,
          source_account_id: SUBMISSION.sourceAccountId,
          source_sequence: SUBMISSION.sourceSequence,
          memo: null,
          expires_at: SUBMISSION.expiresAt,
          signed_xdr: SUBMISSION.signedXdr,
          transaction_hash: TRANSACTION_HASH,
          application_id: null,
          campaign_id: null,
          period: null,
          last_correlation_id: CORRELATION_ID,
          revenue_share_distribution_recipient: [
            { position: 0, account_id: FIRST_RECIPIENT_ACCOUNT, amount_stroops: "10000000" },
            { position: 1, account_id: SECOND_RECIPIENT_ACCOUNT, amount_stroops: "2500000" }
          ]
        }
      ]);
      expect(result.value.record).not.toHaveProperty("memo");
      expect(result.value.record).not.toHaveProperty("applicationId");
      expect(result.value.record).not.toHaveProperty("campaignId");
    });

    it("decodes an exact decimal-string amount losslessly, the form the write path sends", async () => {
      const largeAmount = "9007199254740993";
      const { client } = createFakeSupabaseClient([
        {
          data: persistedRow({
            revenue_share_distribution_recipient: recipientRows([
              { position: 0, account_id: FIRST_RECIPIENT_ACCOUNT, amount_stroops: largeAmount }
            ])
          }),
          error: null
        }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.submit({
        record: {
          ...SUBMISSION,
          recipients: [{ accountId: FIRST_RECIPIENT_ACCOUNT, amountStroops: 9_007_199_254_740_993n }]
        },
        correlationId: CORRELATION_ID
      });

      if (!result.ok) {
        throw new Error("expected the submission to be applied");
      }
      expect(result.value.record.recipients).toEqual([
        { accountId: FIRST_RECIPIENT_ACCOUNT, amountStroops: 9_007_199_254_740_993n }
      ]);
    });

    it("returns the original record with applied: false for an exact replay", async () => {
      const { client, calls } = createFakeSupabaseClient([
        { data: null, error: fakeError("23505") },
        { data: persistedRow({ last_correlation_id: ORIGINAL_CORRELATION_ID }), error: null }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.submit({ record: SUBMISSION, correlationId: CORRELATION_ID });

      expect(result).toEqual({
        ok: true,
        value: {
          record: { ...EXPECTED_RECORD, lastCorrelationId: ORIGINAL_CORRELATION_ID },
          applied: false
        }
      });
      // A replay writes nothing new: exactly one insert was attempted.
      expect(calls.insert).toHaveLength(1);
    });

    it("reports idempotency_conflict when the same distribution id arrives with a different hash", async () => {
      const { client } = createFakeSupabaseClient([
        { data: null, error: fakeError("23505") },
        { data: persistedRow({ transaction_hash: OTHER_TRANSACTION_HASH }), error: null }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.submit({ record: SUBMISSION, correlationId: CORRELATION_ID });

      expect(result).toEqual({ ok: false, error: { code: "idempotency_conflict" } });
    });

    it("reports idempotency_conflict when the same hash arrives under a different distribution id", async () => {
      const { client } = createFakeSupabaseClient([
        { data: null, error: fakeError("23505") },
        // The follow-up read is keyed by the submitted distribution id, which
        // does not exist: the unique violation could only come from
        // transaction_hash.
        { data: null, error: null }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.submit({
        record: { ...SUBMISSION, distributionId: OTHER_DISTRIBUTION_ID },
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "idempotency_conflict" } });
    });

    it("reports already_distributed when the campaign and period already have a live distribution", async () => {
      const { client } = createFakeSupabaseClient([
        {
          data: null,
          error: {
            ...fakeError("23505"),
            message: `duplicate key value violates unique constraint "${PERIOD_INDEX}"`
          }
        },
        // The follow-up read by the submitted id finds nothing: the violation
        // came from the period index, not from this distribution's key.
        { data: null, error: null }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.submit({
        record: { ...SUBMISSION, distributionId: OTHER_DISTRIBUTION_ID },
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "already_distributed" } });
      expect(JSON.stringify(result)).not.toContain(PERIOD_INDEX);
    });

    it("maps a non-unique PostgREST failure to unavailable", async () => {
      const { client } = createFakeSupabaseClient([{ data: null, error: fakeError("23514") }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.submit({ record: SUBMISSION, correlationId: CORRELATION_ID });

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    });

    it("maps a thrown transport rejection to unavailable", async () => {
      const { client } = createFakeSupabaseClient([
        { reject: new Error("fetch failed: network unreachable") }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.submit({ record: SUBMISSION, correlationId: CORRELATION_ID });

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    });
  });

  describe("findActiveByCampaignPeriod", () => {
    it("reads the non-failed distribution of the campaign and period", async () => {
      const { client, calls } = createFakeSupabaseClient([{ data: persistedRow(), error: null }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findActiveByCampaignPeriod({ campaignId: CAMPAIGN_ID, period: PERIOD });

      expect(result).toEqual({ ok: true, value: EXPECTED_RECORD });
      expect(calls.eq).toEqual([
        ["campaign_id", CAMPAIGN_ID],
        ["period", PERIOD]
      ]);
      expect(calls.neq).toEqual([["state", "failed"]]);
    });

    it("reports not_found when no live distribution exists", async () => {
      const { client } = createFakeSupabaseClient([{ data: null, error: null }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findActiveByCampaignPeriod({ campaignId: CAMPAIGN_ID, period: PERIOD });

      expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    });

    it("maps a PostgREST failure to unavailable", async () => {
      const { client } = createFakeSupabaseClient([{ data: null, error: fakeError("PGRST000") }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findActiveByCampaignPeriod({ campaignId: CAMPAIGN_ID, period: PERIOD });

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    });
  });

  describe("findById", () => {
    it("returns the persisted record for a known distribution id, read by the exact key", async () => {
      const { client, calls } = createFakeSupabaseClient([{ data: persistedRow(), error: null }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findById(DISTRIBUTION_ID);

      expect(result).toEqual({ ok: true, value: EXPECTED_RECORD });
      expect(calls.eq).toEqual([["distribution_id", DISTRIBUTION_ID]]);
    });

    it("reads back an empty memo, which is a value rather than a malformed row", async () => {
      const { client } = createFakeSupabaseClient([{ data: persistedRow({ memo: "" }), error: null }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findById(DISTRIBUTION_ID);

      if (!result.ok) {
        throw new Error("expected the record to be read");
      }

      expect(result.value.memo).toBe("");
    });

    it("reports not_found for an unknown distribution id, distinct from other errors", async () => {
      const { client } = createFakeSupabaseClient([{ data: null, error: null }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findById(DISTRIBUTION_ID);

      expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    });

    it("maps a thrown transport rejection to unavailable", async () => {
      const { client } = createFakeSupabaseClient([
        { reject: new Error("fetch failed: network unreachable") }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findById(DISTRIBUTION_ID);

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    });

    it.each([
      ["non-integer string amount", { revenue_share_distribution_recipient: recipientRows([
        { position: 0, account_id: FIRST_RECIPIENT_ACCOUNT, amount_stroops: "12.5" }
      ]) }],
      ["a zero-stroop recipient", { revenue_share_distribution_recipient: recipientRows([
        { position: 0, account_id: FIRST_RECIPIENT_ACCOUNT, amount_stroops: "0" }
      ]) }],
      ["an invalid recipient account", { revenue_share_distribution_recipient: recipientRows([
        { position: 0, account_id: "not-a-stellar-account", amount_stroops: "10000000" }
      ]) }],
      ["duplicate recipient accounts", { revenue_share_distribution_recipient: recipientRows([
        { position: 0, account_id: FIRST_RECIPIENT_ACCOUNT, amount_stroops: "10000000" },
        { position: 1, account_id: FIRST_RECIPIENT_ACCOUNT, amount_stroops: "2500000" }
      ]) }],
      ["a non-array recipient collection", { revenue_share_distribution_recipient: null }],
      ["a negative recipient position", { revenue_share_distribution_recipient: recipientRows([
        { position: -1, account_id: FIRST_RECIPIENT_ACCOUNT, amount_stroops: "10000000" }
      ]) }],
      // The real read-side hazard: PostgREST renders bigint as an unquoted JSON
      // number, so the client parse has already rounded this before the adapter
      // sees it. Rejecting it is the point — truncating silently is not.
      ["an imprecise JSON number amount", { revenue_share_distribution_recipient: recipientRows([
        { position: 0, account_id: FIRST_RECIPIENT_ACCOUNT, amount_stroops: Number.MAX_SAFE_INTEGER + 1 }
      ]) }],
      ["state outside the demo's vocabulary", { state: "manual_review" }],
      ["a negative attempt count", { confirmation_attempts: -1 }],
      ["a fractional attempt count", { confirmation_attempts: 1.5 }],
      ["a malformed ledger sequence", { ledger_sequence: "not-a-ledger" }],
      ["confirmed evidence without a confirmed state", { confirmed_at: CONFIRMED_AT, ledger_sequence: LEDGER_SEQUENCE }],
      ["a failure reason on a non-failed state", { failure_reason: "expired" }],
      ["a failed state without a failure reason", { state: "failed", failure_reason: null }],
      ["non-uuid correlation id", { last_correlation_id: "not-a-uuid" }],
      ["missing distribution id", { distribution_id: null }],
      ["missing transaction hash", { transaction_hash: "" }]
    ])("maps a malformed row (%s) to unavailable", async (_label, overrides) => {
      const { client } = createFakeSupabaseClient([{ data: persistedRow(overrides), error: null }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findById(DISTRIBUTION_ID);

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    });
  });

  describe("recordConfirmation", () => {
    it("transitions submitted to confirmed, conditional on the current state", async () => {
      const { client, calls } = createFakeSupabaseClient([
        {
          data: persistedRow({
            state: "confirmed",
            confirmed_at: CONFIRMED_AT,
            ledger_sequence: LEDGER_SEQUENCE
          }),
          error: null
        }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.recordConfirmation({
        distributionId: DISTRIBUTION_ID,
        confirmation: { outcome: "confirmed", ledgerSequence: LEDGER_SEQUENCE, confirmedAt: CONFIRMED_AT },
        correlationId: CORRELATION_ID
      });

      // The payload is Horizon's evidence, not a local clock: `confirmed_at` is
      // the ledger close time Horizon reported and `ledger_sequence` names the
      // ledger that included it.
      expect(calls.update).toEqual([
        {
          state: "confirmed",
          confirmed_at: CONFIRMED_AT,
          ledger_sequence: LEDGER_SEQUENCE,
          last_correlation_id: CORRELATION_ID
        }
      ]);
      // The transition is a conditional UPDATE, never an upsert: a replayed
      // confirmation matches no row instead of applying twice.
      expect(calls.eq).toEqual([
        ["distribution_id", DISTRIBUTION_ID],
        ["state", "submitted"]
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected the transition to be applied");
      expect(result.value.applied).toBe(true);
      expect(result.value.record.state).toBe("confirmed");
      expect(result.value.record.confirmedAt).toBe(CONFIRMED_AT);
      expect(result.value.record.ledgerSequence).toBe(LEDGER_SEQUENCE);
    });

    it("transitions submitted to failed, carrying the sanitised reason", async () => {
      const { client, calls } = createFakeSupabaseClient([
        { data: persistedRow({ state: "failed", failure_reason: "insufficient_balance" }), error: null }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.recordConfirmation({
        distributionId: DISTRIBUTION_ID,
        confirmation: { outcome: "failed", reason: "insufficient_balance" },
        correlationId: CORRELATION_ID
      });

      expect(calls.update).toEqual([
        {
          state: "failed",
          failure_reason: "insufficient_balance",
          last_correlation_id: CORRELATION_ID
        }
      ]);
      expect(calls.eq).toEqual([
        ["distribution_id", DISTRIBUTION_ID],
        ["state", "submitted"]
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected the transition to be applied");
      expect(result.value.applied).toBe(true);
      expect(result.value.record.state).toBe("failed");
      expect(result.value.record.failureReason).toBe("insufficient_balance");
    });

    it("reports applied: false when the distribution is already terminal", async () => {
      const { client } = createFakeSupabaseClient([
        // The conditional UPDATE matched no row...
        { data: null, error: null },
        // ...because the row is already `confirmed`, which the follow-up read shows.
        {
          data: persistedRow({
            state: "confirmed",
            confirmed_at: CONFIRMED_AT,
            ledger_sequence: LEDGER_SEQUENCE
          }),
          error: null
        }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.recordConfirmation({
        distributionId: DISTRIBUTION_ID,
        confirmation: { outcome: "confirmed", ledgerSequence: LEDGER_SEQUENCE, confirmedAt: CONFIRMED_AT },
        correlationId: CORRELATION_ID
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected the existing record to be returned");
      expect(result.value.applied).toBe(false);
      expect(result.value.record.state).toBe("confirmed");
    });

    it("reports not_found when no row carries the distribution id", async () => {
      const { client } = createFakeSupabaseClient([
        { data: null, error: null },
        { data: null, error: null }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.recordConfirmation({
        distributionId: DISTRIBUTION_ID,
        confirmation: { outcome: "failed", reason: "expired" },
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    });

    it("maps a thrown transport rejection to unavailable", async () => {
      const { client } = createFakeSupabaseClient([
        { reject: new Error("fetch failed: network unreachable") }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.recordConfirmation({
        distributionId: DISTRIBUTION_ID,
        confirmation: { outcome: "failed", reason: "expired" },
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    });
  });

  describe("recordAttempt", () => {
    it("advances the attempt count and the next attempt, conditional on the state", async () => {
      const { client, calls } = createFakeSupabaseClient([
        { data: persistedRow({ confirmation_attempts: 3, next_attempt_at: NEXT_ATTEMPT_AT }), error: null }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.recordAttempt({
        distributionId: DISTRIBUTION_ID,
        attempts: 3,
        nextAttemptAt: NEXT_ATTEMPT_AT,
        correlationId: CORRELATION_ID
      });

      expect(calls.update).toEqual([
        {
          confirmation_attempts: 3,
          next_attempt_at: NEXT_ATTEMPT_AT,
          last_correlation_id: CORRELATION_ID
        }
      ]);
      expect(calls.eq).toEqual([
        ["distribution_id", DISTRIBUTION_ID],
        ["state", "submitted"]
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected the attempt to be recorded");
      expect(result.value.applied).toBe(true);
      // The state does not move: an inconclusive attempt is still `submitted`.
      expect(result.value.record.state).toBe("submitted");
      expect(result.value.record.confirmationAttempts).toBe(3);
    });

    it("reports applied: false when the distribution already reached a terminal state", async () => {
      const { client } = createFakeSupabaseClient([
        { data: null, error: null },
        { data: persistedRow({ state: "failed", failure_reason: "expired" }), error: null }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.recordAttempt({
        distributionId: DISTRIBUTION_ID,
        attempts: 1,
        nextAttemptAt: NEXT_ATTEMPT_AT,
        correlationId: CORRELATION_ID
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected the existing record to be returned");
      expect(result.value.applied).toBe(false);
      expect(result.value.record.state).toBe("failed");
    });

    it("reports not_found when no row carries the distribution id", async () => {
      const { client } = createFakeSupabaseClient([
        { data: null, error: null },
        { data: null, error: null }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.recordAttempt({
        distributionId: DISTRIBUTION_ID,
        attempts: 1,
        nextAttemptAt: NEXT_ATTEMPT_AT,
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    });
  });

  describe("findPending", () => {
    it("reads the rows still awaiting confirmation that are due, oldest first", async () => {
      const { client, calls } = createFakeSupabaseClient([{ data: [persistedRow()], error: null }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findPending({ now: UPDATED_AT, limit: 10 });

      // Only `submitted` rows are pending: a terminal row is never polled again.
      expect(calls.eq).toEqual([["state", "submitted"]]);
      expect(calls.lte).toEqual([["next_attempt_at", UPDATED_AT]]);
      expect(calls.order).toEqual([["next_attempt_at", { ascending: true }]]);
      expect(calls.limit).toEqual([10]);
      expect(result).toEqual({ ok: true, value: [EXPECTED_RECORD] });
    });

    it("returns an empty list when nothing is due, which is not an error", async () => {
      const { client } = createFakeSupabaseClient([{ data: [], error: null }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findPending({ now: UPDATED_AT, limit: 10 });

      expect(result).toEqual({ ok: true, value: [] });
    });

    it("maps a malformed row in the batch to unavailable rather than skipping it", async () => {
      const { client } = createFakeSupabaseClient([
        { data: [persistedRow({ state: "manual_review" })], error: null }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findPending({ now: UPDATED_AT, limit: 10 });

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    });

    it("maps a thrown transport rejection to unavailable", async () => {
      const { client } = createFakeSupabaseClient([
        { reject: new Error("fetch failed: network unreachable") }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.findPending({ now: UPDATED_AT, limit: 10 });

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    });
  });

  describe("listByCampaign (#438/WU2)", () => {
    it("lists every distribution of the campaign in any state, oldest first", async () => {
      const failed = persistedRow({
        distribution_id: OTHER_DISTRIBUTION_ID,
        transaction_hash: OTHER_TRANSACTION_HASH,
        state: "failed",
        failure_reason: "unsuccessful"
      });
      const { client, calls } = createFakeSupabaseClient([{ data: [persistedRow(), failed], error: null }]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const result = await repository.listByCampaign(CAMPAIGN_ID);

      expect(calls.eq).toEqual([["campaign_id", CAMPAIGN_ID]]);
      // No state filter: a failed distribution is evidence too.
      expect(calls.neq).toEqual([]);
      expect(calls.order).toEqual([
        ["created_at", { ascending: true }],
        ["distribution_id", { ascending: true }]
      ]);
      expect(result).toEqual({
        ok: true,
        value: [
          EXPECTED_RECORD,
          {
            ...EXPECTED_RECORD,
            distributionId: OTHER_DISTRIBUTION_ID,
            transactionHash: OTHER_TRANSACTION_HASH,
            state: "failed",
            failureReason: "unsuccessful"
          }
        ]
      });
    });

    it("answers an empty list for a campaign without distributions, which is not not_found", async () => {
      const { client } = createFakeSupabaseClient([{ data: [], error: null }]);

      const result = await new SupabaseRevenueShareDistributionRepository(client).listByCampaign(CAMPAIGN_ID);

      expect(result).toEqual({ ok: true, value: [] });
    });

    it("maps a malformed row, a PostgREST error or a transport rejection to a bare unavailable", async () => {
      const { client } = createFakeSupabaseClient([
        { data: [persistedRow({ state: "manual_review" })], error: null },
        { data: null, error: fakeError("42501") },
        { reject: new Error("fetch failed: network unreachable") }
      ]);
      const repository = new SupabaseRevenueShareDistributionRepository(client);

      const results = [
        await repository.listByCampaign(CAMPAIGN_ID),
        await repository.listByCampaign(CAMPAIGN_ID),
        await repository.listByCampaign(CAMPAIGN_ID)
      ];

      for (const result of results) {
        expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
      }
      expect(JSON.stringify(results)).not.toMatch(/simulated (message|details|hint)/);
    });
  });

  describe("error mapping and sanitization", () => {
    it.each(["23503", "23514", "42501", "PGRST000", "08P01"])(
      "maps Postgres/PostgREST error %s to unavailable",
      async (code) => {
        const { client } = createFakeSupabaseClient([{ data: null, error: fakeError(code) }]);
        const repository = new SupabaseRevenueShareDistributionRepository(client);

        const result = await repository.findById(DISTRIBUTION_ID);

        expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
      }
    );

    it("never returns message, details, or hint on any mapped error", async () => {
      const forbiddenKeys = ["message", "details", "hint"];

      const submitResult = await new SupabaseRevenueShareDistributionRepository(
        createFakeSupabaseClient([{ data: null, error: fakeError("23514") }]).client
      ).submit({ record: SUBMISSION, correlationId: CORRELATION_ID });

      const conflictResult = await new SupabaseRevenueShareDistributionRepository(
        createFakeSupabaseClient([
          { data: null, error: fakeError("23505") },
          { data: persistedRow({ transaction_hash: OTHER_TRANSACTION_HASH }), error: null }
        ]).client
      ).submit({ record: SUBMISSION, correlationId: CORRELATION_ID });

      const findResult = await new SupabaseRevenueShareDistributionRepository(
        createFakeSupabaseClient([{ data: null, error: fakeError("42501") }]).client
      ).findById(DISTRIBUTION_ID);

      for (const result of [submitResult, conflictResult, findResult]) {
        if (result.ok) {
          throw new Error("expected every scenario in this test to produce an error result");
        }
        for (const forbiddenKey of forbiddenKeys) {
          expect(Object.keys(result.error)).not.toContain(forbiddenKey);
        }
      }
    });
  });
});

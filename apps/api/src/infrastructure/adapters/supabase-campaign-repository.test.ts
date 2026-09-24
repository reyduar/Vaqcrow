import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type {
  CampaignRecord,
  ChainCampaignSnapshot
} from "../../application/ports/campaign-repository-port.js";
import { SupabaseCampaignRepository } from "./supabase-campaign-repository.js";

const CAMPAIGN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const OBSERVED_AT = "2026-09-23T18:00:00.000Z";
const SME_ACCOUNT_ID = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

const CAMPAIGN: CampaignRecord = {
  campaignId: CAMPAIGN_ID,
  applicationId: APPLICATION_ID,
  smeAccountId: SME_ACCOUNT_ID,
  contractAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  network: "testnet",
  tokenContractAddress: "CBFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFZ",
  goalStroops: 10_000n,
  deadline: "2026-10-01T00:00:00.000Z",
  state: "open",
  totalStroops: 2_500n,
  reconciliationStatus: "in_sync",
  lastReconciledAt: OBSERVED_AT,
  createdAt: "2026-09-23T17:00:00.000Z",
  updatedAt: "2026-09-23T17:00:00.000Z"
};

const SNAPSHOT: ChainCampaignSnapshot = {
  state: "open",
  totalStroops: 3_000n,
  observedAt: "2026-09-23T18:05:00.000Z",
  contributions: [
    {
      investorAccountId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      amountStroops: 3_000n,
      lastObservedAt: "2026-09-23T18:05:00.000Z"
    }
  ]
};

interface FakePostgrestError {
  readonly code: string;
  readonly message: string;
  readonly details: string;
  readonly hint: string;
}

type FakeStep = { readonly data: unknown; readonly error: FakePostgrestError | null } | { readonly reject: Error };

interface RecordedCalls {
  readonly tables: string[];
  readonly insert: unknown[];
  readonly update: unknown[];
  readonly eq: Array<readonly [column: string, value: unknown]>;
  readonly lte: Array<readonly [column: string, value: unknown]>;
  readonly order: Array<readonly [column: string, options: unknown]>;
}

function fakeError(code: string): FakePostgrestError {
  return {
    code,
    message: `sensitive message for ${code}`,
    details: "sensitive details",
    hint: "sensitive hint"
  };
}

function createFakeSupabaseClient(steps: readonly FakeStep[]): { client: SupabaseClient; calls: RecordedCalls } {
  let cursor = 0;
  const calls: RecordedCalls = { tables: [], insert: [], update: [], eq: [], lte: [], order: [] };

  function nextResult(): Promise<{ data: unknown; error: FakePostgrestError | null }> {
    const step = steps[cursor++];
    if (!step) throw new Error(`missing scripted response for call #${cursor}`);
    if ("reject" in step) return Promise.reject(step.reject);
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
      lte: (column: string, value: unknown) => {
        calls.lte.push([column, value]);
        return self;
      },
      order: (column: string, options: unknown) => {
        calls.order.push([column, options]);
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
    client: {
      from: (table: string) => {
        calls.tables.push(table);
        return builder();
      }
    } as unknown as SupabaseClient,
    calls
  };
}

function persistedCampaign(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    campaign_id: CAMPAIGN.campaignId,
    application_id: CAMPAIGN.applicationId,
    sme_account_id: CAMPAIGN.smeAccountId,
    contract_address: CAMPAIGN.contractAddress,
    network: CAMPAIGN.network,
    token_contract_address: CAMPAIGN.tokenContractAddress,
    goal_stroops: CAMPAIGN.goalStroops.toString(),
    deadline: CAMPAIGN.deadline,
    state: CAMPAIGN.state,
    total_stroops: CAMPAIGN.totalStroops.toString(),
    reconciliation_status: CAMPAIGN.reconciliationStatus,
    last_reconciled_at: CAMPAIGN.lastReconciledAt,
    last_diverged_at: null,
    created_at: CAMPAIGN.createdAt,
    updated_at: CAMPAIGN.updatedAt,
    ...overrides
  };
}

describe("SupabaseCampaignRepository", () => {
  it("persists only a chain-observed campaign snapshot", async () => {
    const { client, calls } = createFakeSupabaseClient([{ data: persistedCampaign(), error: null }]);
    const result = await new SupabaseCampaignRepository(client).create({
      campaign: CAMPAIGN,
      correlationId: CORRELATION_ID
    });

    expect(result).toEqual({ ok: true, value: CAMPAIGN });
    expect(calls.tables).toEqual(["campaign"]);
    expect(calls.insert).toEqual([
      {
        campaign_id: CAMPAIGN.campaignId,
        application_id: CAMPAIGN.applicationId,
        sme_account_id: CAMPAIGN.smeAccountId,
        contract_address: CAMPAIGN.contractAddress,
        network: "testnet",
        token_contract_address: CAMPAIGN.tokenContractAddress,
        goal_stroops: "10000",
        deadline: CAMPAIGN.deadline,
        state: "open",
        total_stroops: "2500",
        reconciliation_status: "in_sync",
        last_reconciled_at: OBSERVED_AT,
        last_correlation_id: CORRELATION_ID
      }
    ]);
  });

  it("maps a duplicate campaign to already_exists and does not expose PostgREST text", async () => {
    const { client } = createFakeSupabaseClient([{ data: null, error: fakeError("23505") }]);
    const result = await new SupabaseCampaignRepository(client).create({
      campaign: CAMPAIGN,
      correlationId: CORRELATION_ID
    });

    expect(result).toEqual({ ok: false, error: { code: "already_exists" } });
  });

  it("uses the conditional state and observation timestamp to reconcile, then mirrors contributions", async () => {
    const reconciled = persistedCampaign({
      state: SNAPSHOT.state,
      total_stroops: SNAPSHOT.totalStroops.toString(),
      last_reconciled_at: SNAPSHOT.observedAt,
      reconciliation_status: "diverged",
      last_diverged_at: SNAPSHOT.observedAt
    });
    const { client, calls } = createFakeSupabaseClient([
      { data: reconciled, error: null },
      { data: null, error: null }
    ]);

    const result = await new SupabaseCampaignRepository(client).reconcile({
      campaignId: CAMPAIGN_ID,
      expectedState: "open",
      snapshot: SNAPSHOT,
      reconciliationStatus: "diverged",
      correlationId: CORRELATION_ID
    });

    expect(result).toEqual({
      ok: true,
      value: { campaign: { ...CAMPAIGN, totalStroops: 3_000n, reconciliationStatus: "diverged", lastReconciledAt: SNAPSHOT.observedAt, lastDivergedAt: SNAPSHOT.observedAt }, applied: true }
    });
    expect(calls.eq.slice(0, 2)).toEqual([["campaign_id", CAMPAIGN_ID], ["state", "open"]]);
    expect(calls.lte).toEqual([["last_reconciled_at", SNAPSHOT.observedAt]]);
    expect(calls.insert).toContainEqual({
      campaign_id: CAMPAIGN_ID,
      investor_account_id: SNAPSHOT.contributions[0]?.investorAccountId,
      amount_stroops: "3000",
      last_observed_at: SNAPSHOT.observedAt,
      last_correlation_id: CORRELATION_ID
    });
  });

  it("makes a replayed reconciliation a non-application without rewriting contributions", async () => {
    const { client, calls } = createFakeSupabaseClient([
      { data: null, error: null },
      { data: persistedCampaign({ total_stroops: "3000", last_reconciled_at: SNAPSHOT.observedAt }), error: null }
    ]);

    const result = await new SupabaseCampaignRepository(client).reconcile({
      campaignId: CAMPAIGN_ID,
      expectedState: "open",
      snapshot: SNAPSHOT,
      reconciliationStatus: "in_sync",
      correlationId: CORRELATION_ID
    });

    expect(result).toMatchObject({ ok: true, value: { applied: false } });
    expect(calls.tables).toEqual(["campaign", "campaign"]);
    expect(calls.insert).toEqual([]);
  });

  it("updates a contribution explicitly after a duplicate observation", async () => {
    const { client, calls } = createFakeSupabaseClient([
      { data: persistedCampaign({ total_stroops: "3000", last_reconciled_at: SNAPSHOT.observedAt }), error: null },
      { data: null, error: fakeError("23505") },
      { data: null, error: null }
    ]);

    const result = await new SupabaseCampaignRepository(client).reconcile({
      campaignId: CAMPAIGN_ID,
      expectedState: "open",
      snapshot: SNAPSHOT,
      reconciliationStatus: "in_sync",
      correlationId: CORRELATION_ID
    });

    expect(result).toMatchObject({ ok: true, value: { applied: true } });
    expect(calls.update).toContainEqual({
      campaign_id: CAMPAIGN_ID,
      investor_account_id: SNAPSHOT.contributions[0]?.investorAccountId,
      amount_stroops: "3000",
      last_observed_at: SNAPSHOT.observedAt,
      last_correlation_id: CORRELATION_ID
    });
    expect(calls.lte).toContainEqual(["last_observed_at", SNAPSHOT.observedAt]);
  });

  it("never writes a contribution row for a zero-amount entry (nothing contributed yet — Task #248/T4's live suite found this against the real schema: `campaign_contribution_amount_stroops_check` requires `amount_stroops > 0`, so persisting a zero-amount row for an investor who has merely connected and never contributed used to fail the whole reconcile with a check-constraint violation)", async () => {
    const zeroSnapshot: ChainCampaignSnapshot = {
      state: "open",
      totalStroops: 0n,
      observedAt: "2026-09-23T18:05:00.000Z",
      contributions: [
        {
          investorAccountId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          amountStroops: 0n,
          lastObservedAt: "2026-09-23T18:05:00.000Z"
        }
      ]
    };
    const { client, calls } = createFakeSupabaseClient([
      { data: persistedCampaign({ total_stroops: "0", last_reconciled_at: zeroSnapshot.observedAt }), error: null }
    ]);

    const result = await new SupabaseCampaignRepository(client).reconcile({
      campaignId: CAMPAIGN_ID,
      expectedState: "open",
      snapshot: zeroSnapshot,
      reconciliationStatus: "in_sync",
      correlationId: CORRELATION_ID
    });

    expect(result).toMatchObject({ ok: true, value: { applied: true } });
    // Only the `campaign` table is touched — `campaign_contribution` never
    // sees an insert or an update for the zero-amount entry.
    expect(calls.tables).toEqual(["campaign"]);
    expect(calls.insert).toEqual([]);
  });

  it("updates a refund contact after a duplicate key without logging its PII", async () => {
    const contact = {
      campaignId: CAMPAIGN_ID,
      investorAccountId: SNAPSHOT.contributions[0]?.investorAccountId ?? "",
      notificationEmail: "investor@example.test",
      refundDueAt: "2026-10-02T00:00:00.000Z"
    };
    const { client, calls } = createFakeSupabaseClient([
      { data: null, error: fakeError("23505") },
      { data: { campaign_id: contact.campaignId, investor_account_id: contact.investorAccountId, notification_email: contact.notificationEmail, refund_due_at: contact.refundDueAt, notified_at: null }, error: null }
    ]);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await new SupabaseCampaignRepository(client).saveRefundContact({ contact, correlationId: CORRELATION_ID });

    expect(result).toEqual({ ok: true, value: contact });
    expect(calls.update).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("sanitizes a database failure without logging the row or PostgREST message", async () => {
    const { client } = createFakeSupabaseClient([{ data: null, error: fakeError("42501") }]);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await new SupabaseCampaignRepository(client).findById(CAMPAIGN_ID);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(error).toHaveBeenCalledWith("[SupabaseCampaignRepository] persistence error", {
      code: "42501",
      correlationId: undefined
    });
    error.mockRestore();
  });

  it("finds the campaign already mirrored for an application, for the open-campaign replay check (D5)", async () => {
    const { client, calls } = createFakeSupabaseClient([{ data: persistedCampaign(), error: null }]);

    const result = await new SupabaseCampaignRepository(client).findByApplicationId(APPLICATION_ID);

    expect(result).toEqual({ ok: true, value: CAMPAIGN });
    expect(calls.tables).toEqual(["campaign"]);
    expect(calls.eq).toEqual([["application_id", APPLICATION_ID]]);
  });

  it("reports not_found for an application that has not opened a campaign yet", async () => {
    const { client } = createFakeSupabaseClient([{ data: null, error: null }]);

    const result = await new SupabaseCampaignRepository(client).findByApplicationId(APPLICATION_ID);

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("sanitizes a database failure on findByApplicationId without logging the row or PostgREST message", async () => {
    const { client } = createFakeSupabaseClient([{ data: null, error: fakeError("42501") }]);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await new SupabaseCampaignRepository(client).findByApplicationId(APPLICATION_ID);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    error.mockRestore();
  });
});

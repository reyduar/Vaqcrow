import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabasePortfolioRepository } from "./supabase-portfolio-repository.js";

function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  Reflect.deleteProperty(copy, key);
  return copy;
}

/**
 * The portfolio read adapter (#426, WU1). It reads the two service_role-only
 * views, filters by the resolved investor account, and maps PostgREST's
 * text/numeric columns back to typed records. A malformed row or a provider
 * error is `unavailable`; the provider's message/details/hint and the private
 * object path never reach the caller.
 */
const ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const DISTRIBUTION_ID = "323e4567-e89b-42d3-a456-426614174000";

const POSITION_ROW = {
  investor_account_id: ACCOUNT,
  campaign_id: CAMPAIGN_ID,
  name: "Panadería Sol",
  sector: "Alimentos",
  city: "CABA",
  goal_ars: "5000000",
  total_stroops: "2500000",
  goal_stroops: "10000000",
  deadline: "2026-12-01T00:00:00.000Z",
  state: "open",
  contract_address: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  contribution_stroops: "1500000",
  fx_rate_version: "5",
  usd_to_ars: "1000000000",
  stroops_per_usd: "10000000",
  image_object_path: "owner/photo/a.jpg",
  image_content_type: "image/jpeg"
};

const DISTRIBUTION_ROW = {
  investor_account_id: ACCOUNT,
  distribution_id: DISTRIBUTION_ID,
  campaign_id: CAMPAIGN_ID,
  campaign_name: "Panadería Sol",
  period: "2026-06",
  amount_stroops: "12500000",
  state: "confirmed",
  recorded_at: "2026-07-01T00:00:00.000Z",
  transaction_hash: "d".repeat(64)
};

const TRANSACTION_ROW = {
  investor_account_id: ACCOUNT,
  transaction_hash: "a".repeat(64),
  campaign_id: CAMPAIGN_ID,
  campaign_name: "Panadería Sol",
  vault_address: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  amount_stroops: "1500000",
  observed_at: "2026-03-15T00:00:00+00:00"
};

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

function fakeClient(perTable: Record<string, FakeStep>): {
  client: SupabaseClient;
  from: string[];
  eq: Array<readonly [string, unknown]>;
  order: Array<readonly [string, unknown]>;
} {
  const from: string[] = [];
  const eq: Array<readonly [string, unknown]> = [];
  const order: Array<readonly [string, unknown]> = [];
  const client = {
    from: (table: string) => {
      from.push(table);
      const step = perTable[table] ?? { data: [] };
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          eq.push([column, value]);
          return builder;
        },
        order: (column: string, options: unknown) => {
          order.push([column, options]);
          return builder;
        },
        then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
          const settled = step.reject
            ? Promise.reject(step.reject)
            : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });
          return settled.then(onFulfilled, onRejected);
        }
      };
      return builder;
    }
  } as unknown as SupabaseClient;
  return { client, from, eq, order };
}

describe("SupabasePortfolioRepository", () => {
  it("reads the positions view scoped by the investor account, ordered by deadline", async () => {
    const { client, from, eq, order } = fakeClient({ investor_portfolio_position: { data: [POSITION_ROW] } });

    const result = await new SupabasePortfolioRepository(client).listPositions(ACCOUNT);

    expect(from).toEqual(["investor_portfolio_position"]);
    expect(eq).toEqual([["investor_account_id", ACCOUNT]]);
    expect(order).toEqual([["deadline", { ascending: true }]]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          campaignId: CAMPAIGN_ID,
          name: "Panadería Sol",
          sector: "Alimentos",
          city: "CABA",
          contributionStroops: 1_500_000n,
          goalArs: 5_000_000n,
          totalStroops: 2_500_000n,
          goalStroops: 10_000_000n,
          state: "open",
          closeDate: "2026-12-01T00:00:00.000Z",
          vaultAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
          hasImage: true,
          rateSnapshot: { usdToArs: 1_000_000_000n, stroopsPerUsd: 10_000_000n }
        }
      ]
    });
  });

  it("maps a bare position (no image, no rate snapshot) to hasImage false and no snapshot", async () => {
    const bare = { ...POSITION_ROW, image_object_path: null, image_content_type: null, fx_rate_version: null, usd_to_ars: null, stroops_per_usd: null };
    const { client } = fakeClient({ investor_portfolio_position: { data: [bare] } });

    const result = await new SupabasePortfolioRepository(client).listPositions(ACCOUNT);

    expect(result.ok && result.value[0]?.hasImage).toBe(false);
    expect(result.ok && result.value[0]?.rateSnapshot).toBeUndefined();
  });

  it("reads the distributions view scoped by the investor account, newest first", async () => {
    const { client, from, eq, order } = fakeClient({ investor_portfolio_distribution: { data: [DISTRIBUTION_ROW] } });

    const result = await new SupabasePortfolioRepository(client).listDistributions(ACCOUNT);

    expect(from).toEqual(["investor_portfolio_distribution"]);
    expect(eq).toEqual([["investor_account_id", ACCOUNT]]);
    expect(order).toEqual([["recorded_at", { ascending: false }]]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          distributionId: DISTRIBUTION_ID,
          campaignId: CAMPAIGN_ID,
          campaignName: "Panadería Sol",
          period: "2026-06",
          amountStroops: 12_500_000n,
          state: "confirmed",
          transactionHash: "d".repeat(64)
        }
      ]
    });
  });

  it("maps a legacy distribution with no campaign, name or period to nulls", async () => {
    const legacy = { ...DISTRIBUTION_ROW, campaign_id: null, campaign_name: null, period: null, state: "failed" };
    const { client } = fakeClient({ investor_portfolio_distribution: { data: [legacy] } });

    const result = await new SupabasePortfolioRepository(client).listDistributions(ACCOUNT);

    expect(result.ok && result.value[0]).toMatchObject({ campaignId: null, campaignName: null, period: null, state: "failed" });
  });

  it("reports unavailable on a provider error, never leaking its text", async () => {
    const { client } = fakeClient({
      investor_portfolio_position: { error: { code: "PGRST500", message: "secret detail", details: "d", hint: "h" } }
    });

    const result = await new SupabasePortfolioRepository(client).listPositions(ACCOUNT);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("secret detail");
  });

  it("reports unavailable on a malformed row or state", async () => {
    const badState = fakeClient({ investor_portfolio_position: { data: [{ ...POSITION_ROW, state: "bogus" }] } });
    const notArray = fakeClient({ investor_portfolio_distribution: { data: { not: "an array" } } });

    expect(await new SupabasePortfolioRepository(badState.client).listPositions(ACCOUNT)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    expect(await new SupabasePortfolioRepository(notArray.client).listDistributions(ACCOUNT)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("reads the observed contribute transactions scoped by the investor account, oldest first (#438/WU3)", async () => {
    const { client, from, eq, order } = fakeClient({ investor_contribution_transaction: { data: [TRANSACTION_ROW] } });

    const result = await new SupabasePortfolioRepository(client).listContributionTransactions(ACCOUNT);

    expect(from).toEqual(["investor_contribution_transaction"]);
    expect(eq).toEqual([["investor_account_id", ACCOUNT]]);
    expect(order).toEqual([["observed_at", { ascending: true }]]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          transactionHash: "a".repeat(64),
          campaignId: CAMPAIGN_ID,
          amountStroops: 1_500_000n,
          observedAt: "2026-03-15T00:00:00+00:00"
        }
      ]
    });
  });

  it("reports unavailable for a distribution without its hash or a transaction without an observation", async () => {
    const noHash = without(DISTRIBUTION_ROW, "transaction_hash");
    const missingHash = fakeClient({ investor_portfolio_distribution: { data: [noHash] } });
    const unobserved = fakeClient({ investor_contribution_transaction: { data: [{ ...TRANSACTION_ROW, observed_at: null }] } });
    const failing = fakeClient({
      investor_contribution_transaction: { error: { code: "PGRST500", message: "secret detail", details: "d", hint: "h" } }
    });

    expect(await new SupabasePortfolioRepository(missingHash.client).listDistributions(ACCOUNT)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    expect(await new SupabasePortfolioRepository(unobserved.client).listContributionTransactions(ACCOUNT)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    const failed = await new SupabasePortfolioRepository(failing.client).listContributionTransactions(ACCOUNT);
    expect(failed).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(failed)).not.toContain("secret detail");
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CampaignDeploymentRecord } from "../../application/ports/campaign-deployment-repository-port.js";
import { SupabaseCampaignDeploymentRepository } from "./supabase-campaign-deployment-repository.js";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const CORRELATION_ID = "123e4567-e89b-42d3-a456-426614174000";
const CONFIRMED_CORRELATION_ID = "123e4567-e89b-42d3-a456-4266141740aa";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";

const ROW = {
  application_id: APPLICATION_ID,
  state: "pending",
  attempts: 0,
  last_error: null,
  campaign_id: null,
  last_correlation_id: CORRELATION_ID,
  created_at: "2026-10-06T12:00:00.000Z",
  updated_at: "2026-10-06T12:00:00.000Z"
};

const EXPECTED: CampaignDeploymentRecord = {
  applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
  state: "pending",
  attempts: 0,
  lastCorrelationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"],
  createdAt: ROW.created_at,
  updatedAt: ROW.updated_at
};

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

/**
 * A terminal-step queue: `single()`/`maybeSingle()` each pop the next step, so a
 * method that reads then writes (or that retries after a unique violation) is
 * exercised against the real sequence of round trips.
 */
function fakeClient(steps: readonly FakeStep[]) {
  const calls = {
    from: [] as string[],
    insert: [] as unknown[],
    update: [] as unknown[],
    eq: [] as Array<readonly [string, unknown]>,
    in: [] as Array<readonly [string, readonly unknown[]]>,
    single: 0,
    maybeSingle: 0
  };
  let cursor = 0;

  const builder = {
    insert: (payload: unknown) => {
      calls.insert.push(payload);
      return builder;
    },
    update: (payload: unknown) => {
      calls.update.push(payload);
      return builder;
    },
    select: () => builder,
    eq: (column: string, value: unknown) => {
      calls.eq.push([column, value]);
      return builder;
    },
    in: (column: string, values: readonly unknown[]) => {
      calls.in.push([column, values]);
      return builder;
    },
    single: () => {
      calls.single += 1;
      return terminal();
    },
    maybeSingle: () => {
      calls.maybeSingle += 1;
      return terminal();
    }
  };

  function terminal(): Promise<{ data: unknown; error: unknown }> {
    const step = steps[cursor] ?? {};
    cursor += 1;
    return step.reject
      ? Promise.reject(step.reject)
      : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });
  }

  const client = {
    from: (table: string) => {
      calls.from.push(table);
      return builder;
    }
  } as unknown as SupabaseClient;

  return { client, calls };
}

const pgError = (code: string) => ({
  code,
  message: "SECRET message",
  details: "SECRET details",
  hint: "SECRET hint"
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SupabaseCampaignDeploymentRepository.findByApplicationId", () => {
  it("scopes the read to the application and maps the stored row", async () => {
    const { client, calls } = fakeClient([{ data: ROW }]);

    const result = await new SupabaseCampaignDeploymentRepository(client).findByApplicationId(
      APPLICATION_ID as CampaignDeploymentRecord["applicationId"]
    );

    expect(calls.from).toEqual(["campaign_deployment"]);
    expect(calls.eq).toEqual([["application_id", APPLICATION_ID]]);
    expect(calls.maybeSingle).toBe(1);
    expect(result).toEqual({ ok: true, value: EXPECTED });
  });

  it("reads back a confirmed row with its campaign id", async () => {
    const { client } = fakeClient([
      { data: { ...ROW, state: "confirmed", attempts: 1, campaign_id: CAMPAIGN_ID } }
    ]);

    const result = await new SupabaseCampaignDeploymentRepository(client).findByApplicationId(
      APPLICATION_ID as CampaignDeploymentRecord["applicationId"]
    );

    expect(result).toEqual({
      ok: true,
      value: { ...EXPECTED, state: "confirmed", attempts: 1, campaignId: CAMPAIGN_ID }
    });
  });

  it("reports not_found for an application with no deployment row", async () => {
    const { client } = fakeClient([{ data: null }]);

    await expect(
      new SupabaseCampaignDeploymentRepository(client).findByApplicationId(
        APPLICATION_ID as CampaignDeploymentRecord["applicationId"]
      )
    ).resolves.toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("is unavailable on a Postgres error or a malformed row, leaking no text", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [
      { error: pgError("XX000") },
      { data: { ...ROW, attempts: -1 } },
      { data: { ...ROW, state: "nonsense" } },
      { reject: new Error("network SECRET") }
    ] as const) {
      const { client } = fakeClient([step]);
      const result = await new SupabaseCampaignDeploymentRepository(client).findByApplicationId(
        APPLICATION_ID as CampaignDeploymentRecord["applicationId"]
      );
      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
      expect(JSON.stringify(result)).not.toContain("SECRET");
    }
  });
});

describe("SupabaseCampaignDeploymentRepository.markPending", () => {
  it("inserts a pending row with the caller's correlation id", async () => {
    const { client, calls } = fakeClient([{ data: ROW }]);

    const result = await new SupabaseCampaignDeploymentRepository(client).markPending({
      applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
      correlationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
    });

    expect(calls.insert).toEqual([
      { application_id: APPLICATION_ID, state: "pending", last_correlation_id: CORRELATION_ID }
    ]);
    expect(result).toEqual({ ok: true, value: EXPECTED });
  });

  it("is idempotent: a unique violation returns the existing row instead of overwriting it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const existing = { ...ROW, state: "failed", attempts: 2, last_error: "unavailable" };
    const { client, calls } = fakeClient([{ error: pgError("23505") }, { data: existing }]);

    const result = await new SupabaseCampaignDeploymentRepository(client).markPending({
      applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
      correlationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
    });

    expect(calls.insert).toHaveLength(1);
    expect(calls.update).toHaveLength(0);
    expect(result).toEqual({
      ok: true,
      value: { ...EXPECTED, state: "failed", attempts: 2, lastError: "unavailable" }
    });
  });

  it("never overwrites a confirmed row", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const confirmed = { ...ROW, state: "confirmed", attempts: 1, campaign_id: CAMPAIGN_ID };
    const { client } = fakeClient([{ error: pgError("23505") }, { data: confirmed }]);

    const result = await new SupabaseCampaignDeploymentRepository(client).markPending({
      applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
      correlationId: CONFIRMED_CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
    });

    expect(result).toEqual({
      ok: true,
      value: { ...EXPECTED, state: "confirmed", attempts: 1, campaignId: CAMPAIGN_ID }
    });
  });

  it("is unavailable for any other insert error or a rejected call", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [{ error: pgError("42501") }, { reject: new Error("network SECRET") }] as const) {
      const { client } = fakeClient([step]);
      const result = await new SupabaseCampaignDeploymentRepository(client).markPending({
        applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
        correlationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
      });
      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    }
  });
});

describe("SupabaseCampaignDeploymentRepository.beginAttempt", () => {
  it("moves a pending row to deploying, increments attempts and clears last_error", async () => {
    const { client, calls } = fakeClient([
      { data: { ...ROW, attempts: 2, last_error: "unavailable" } },
      { data: { ...ROW, state: "deploying", attempts: 3, last_error: null } }
    ]);

    const result = await new SupabaseCampaignDeploymentRepository(client).beginAttempt({
      applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
      correlationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
    });

    expect(calls.update).toEqual([
      {
        state: "deploying",
        attempts: 3,
        last_error: null,
        last_correlation_id: CORRELATION_ID
      }
    ]);
    expect(calls.in).toEqual([["state", ["pending", "failed"]]]);
    expect(result).toEqual({
      ok: true,
      value: { ...EXPECTED, state: "deploying", attempts: 3 }
    });
  });

  it("refuses to start from a confirmed row without writing", async () => {
    const { client, calls } = fakeClient([
      { data: { ...ROW, state: "confirmed", attempts: 1, campaign_id: CAMPAIGN_ID } }
    ]);

    const result = await new SupabaseCampaignDeploymentRepository(client).beginAttempt({
      applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
      correlationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
    });

    expect(result).toEqual({ ok: false, error: { code: "state_conflict" } });
    expect(calls.update).toHaveLength(0);
  });

  it("reports a state conflict when the conditional update matches no row", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient([{ data: ROW }, { error: pgError("PGRST116") }]);

    const result = await new SupabaseCampaignDeploymentRepository(client).beginAttempt({
      applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
      correlationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
    });

    expect(result).toEqual({ ok: false, error: { code: "state_conflict" } });
  });

  it("reports not_found when no deployment row exists yet", async () => {
    const { client, calls } = fakeClient([{ data: null }]);

    const result = await new SupabaseCampaignDeploymentRepository(client).beginAttempt({
      applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
      correlationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
    });

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(calls.update).toHaveLength(0);
  });
});

describe("SupabaseCampaignDeploymentRepository.markConfirmed", () => {
  it("sets the campaign id and the confirmed state", async () => {
    const { client, calls } = fakeClient([
      { data: { ...ROW, state: "confirmed", attempts: 1, campaign_id: CAMPAIGN_ID } }
    ]);

    const result = await new SupabaseCampaignDeploymentRepository(client).markConfirmed({
      applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
      campaignId: CAMPAIGN_ID,
      correlationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
    });

    expect(calls.update).toEqual([
      {
        state: "confirmed",
        campaign_id: CAMPAIGN_ID,
        last_error: null,
        last_correlation_id: CORRELATION_ID
      }
    ]);
    expect(result).toEqual({
      ok: true,
      value: { ...EXPECTED, state: "confirmed", attempts: 1, campaignId: CAMPAIGN_ID }
    });
  });

  it("is not_found when the row no longer exists", async () => {
    const { client } = fakeClient([{ error: pgError("PGRST116") }]);

    const result = await new SupabaseCampaignDeploymentRepository(client).markConfirmed({
      applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
      campaignId: CAMPAIGN_ID,
      correlationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
    });

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
  });
});

describe("SupabaseCampaignDeploymentRepository.markFailed", () => {
  it("stores only the sanitized code, never provider text", async () => {
    const { client, calls } = fakeClient([
      { data: { ...ROW, state: "failed", attempts: 1, last_error: "rate_unavailable" } }
    ]);

    const result = await new SupabaseCampaignDeploymentRepository(client).markFailed({
      applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
      errorCode: "rate_unavailable",
      correlationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
    });

    expect(calls.update).toEqual([
      {
        state: "failed",
        last_error: "rate_unavailable",
        last_correlation_id: CORRELATION_ID
      }
    ]);
    expect(JSON.stringify(calls.update)).not.toContain("message");
    expect(result).toEqual({
      ok: true,
      value: { ...EXPECTED, state: "failed", attempts: 1, lastError: "rate_unavailable" }
    });
  });

  it("is unavailable on a Postgres error or a rejected call", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [{ error: pgError("XX000") }, { reject: new Error("network SECRET") }] as const) {
      const { client } = fakeClient([step]);
      const result = await new SupabaseCampaignDeploymentRepository(client).markFailed({
        applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
        errorCode: "unavailable",
        correlationId: CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"]
      });
      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    }
  });
});

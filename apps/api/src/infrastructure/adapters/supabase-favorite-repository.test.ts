import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseFavoriteRepository } from "./supabase-favorite-repository.js";

/**
 * The Supabase favorites adapter (#414/WU2). It writes only through the
 * service_role client and maps the two Postgres errors the feature must
 * distinguish — a `23505` unique violation (already favorited) and a `23503`
 * foreign-key violation (unknown campaign) — into the port's outcomes; every
 * other failure is a sanitized `unavailable` that never leaks provider text.
 */
const USER_ID = "00000000-0000-4000-8000-000000000002";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER_CAMPAIGN_ID = "223e4567-e89b-42d3-a456-426614174000";

interface DbResult {
  readonly data?: unknown;
  readonly error?: unknown;
  readonly count?: number | null;
}

interface Filter {
  readonly column: string;
  readonly value: unknown;
}

interface Op {
  table: string;
  action: "select" | "insert" | "delete";
  columns?: string | undefined;
  payload?: unknown;
  filters: Filter[];
}

type Handler = (op: Op) => DbResult | Promise<DbResult>;

/** A hand-written structural client: no network, no Supabase. */
function fakeClient(handler: Handler): { client: SupabaseClient; ops: Op[] } {
  const ops: Op[] = [];

  const makeBuilder = (op: Op) => {
    const run = (): Promise<DbResult> => {
      try {
        return Promise.resolve(handler(op));
      } catch (error) {
        return Promise.reject(error);
      }
    };

    const builder = {
      select(columns?: string) {
        op.columns = columns;
        return builder;
      },
      insert(payload: unknown) {
        op.action = "insert";
        op.payload = payload;
        return builder;
      },
      delete() {
        op.action = "delete";
        return builder;
      },
      eq(column: string, value: unknown) {
        op.filters.push({ column, value });
        return builder;
      },
      then(onFulfilled: (value: DbResult) => unknown, onRejected: (reason: unknown) => unknown) {
        return run().then(onFulfilled, onRejected);
      }
    };
    return builder;
  };

  const client = {
    from(table: string) {
      const op: Op = { table, action: "select", filters: [] };
      ops.push(op);
      return makeBuilder(op);
    }
  } as unknown as SupabaseClient;

  return { client, ops };
}

/** A provider error whose fields a caller must never see. */
const pgError = (code: string) => ({
  code,
  message: "SECRET message",
  details: "SECRET details",
  hint: "SECRET hint"
});

const noSecret = (value: unknown) => {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("SECRET message");
  expect(serialized).not.toContain("SECRET details");
  expect(serialized).not.toContain("SECRET hint");
};

afterEach(() => vi.restoreAllMocks());

describe("SupabaseFavoriteRepository.listCampaignIds", () => {
  it("returns the caller's campaign ids, scoped by user_id", async () => {
    const { client, ops } = fakeClient(() => ({
      data: [{ campaign_id: CAMPAIGN_ID }, { campaign_id: OTHER_CAMPAIGN_ID }],
      error: null
    }));

    const result = await new SupabaseFavoriteRepository(client).listCampaignIds(USER_ID);

    expect(result).toEqual({ ok: true, value: [CAMPAIGN_ID, OTHER_CAMPAIGN_ID] });
    expect(ops[0]?.table).toBe("campaign_favorite");
    expect(ops[0]?.columns).toBe("campaign_id");
    expect(ops[0]?.filters).toEqual([{ column: "user_id", value: USER_ID }]);
  });

  it("returns an empty ok list when the caller has no favorites", async () => {
    const { client } = fakeClient(() => ({ data: [], error: null }));

    expect(await new SupabaseFavoriteRepository(client).listCampaignIds(USER_ID)).toEqual({ ok: true, value: [] });
  });

  it("reports unavailable and sanitizes a provider error or a throw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ data: null, error: pgError("42501") }));
    const erroredResult = await new SupabaseFavoriteRepository(errored.client).listCampaignIds(USER_ID);
    expect(erroredResult).toEqual({ ok: false, error: { code: "unavailable" } });
    noSecret(erroredResult);

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseFavoriteRepository(thrown.client).listCampaignIds(USER_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

describe("SupabaseFavoriteRepository.add", () => {
  it("inserts the favorite and reports applied true", async () => {
    const { client, ops } = fakeClient((op) =>
      op.action === "insert" ? { data: [{ campaign_id: CAMPAIGN_ID }], error: null } : { data: null, error: null }
    );

    const result = await new SupabaseFavoriteRepository(client).add(USER_ID, CAMPAIGN_ID);

    expect(result).toEqual({ ok: true, value: { applied: true } });
    expect(ops[0]?.table).toBe("campaign_favorite");
    expect(ops[0]?.action).toBe("insert");
    expect(ops[0]?.payload).toEqual({ user_id: USER_ID, campaign_id: CAMPAIGN_ID });
  });

  it("treats a 23505 unique violation as an idempotent applied:false, never an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient(() => ({ data: null, error: pgError("23505") }));

    const result = await new SupabaseFavoriteRepository(client).add(USER_ID, CAMPAIGN_ID);

    expect(result).toEqual({ ok: true, value: { applied: false } });
    noSecret(result);
  });

  it("maps a 23503 foreign-key violation (unknown campaign) to not_found", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient(() => ({ data: null, error: pgError("23503") }));

    const result = await new SupabaseFavoriteRepository(client).add(USER_ID, CAMPAIGN_ID);

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    noSecret(result);
  });

  it("reports unavailable on any other provider error or a throw, without leaking it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ data: null, error: pgError("42501") }));
    const erroredResult = await new SupabaseFavoriteRepository(errored.client).add(USER_ID, CAMPAIGN_ID);
    expect(erroredResult).toEqual({ ok: false, error: { code: "unavailable" } });
    noSecret(erroredResult);

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseFavoriteRepository(thrown.client).add(USER_ID, CAMPAIGN_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

describe("SupabaseFavoriteRepository.remove", () => {
  it("deletes the favorite scoped to the caller and reports applied true", async () => {
    const { client, ops } = fakeClient((op) =>
      op.action === "delete" ? { data: [{ campaign_id: CAMPAIGN_ID }], error: null } : { data: null, error: null }
    );

    const result = await new SupabaseFavoriteRepository(client).remove(USER_ID, CAMPAIGN_ID);

    expect(result).toEqual({ ok: true, value: { applied: true } });
    expect(ops[0]?.action).toBe("delete");
    expect(ops[0]?.filters).toEqual([
      { column: "user_id", value: USER_ID },
      { column: "campaign_id", value: CAMPAIGN_ID }
    ]);
  });

  it("reports applied false when nothing was deleted (idempotent remove)", async () => {
    const { client } = fakeClient(() => ({ data: [], error: null }));

    expect(await new SupabaseFavoriteRepository(client).remove(USER_ID, CAMPAIGN_ID)).toEqual({
      ok: true,
      value: { applied: false }
    });
  });

  it("reports unavailable on a provider error or a throw, never leaking the provider error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ data: null, error: pgError("42501") }));
    const erroredResult = await new SupabaseFavoriteRepository(errored.client).remove(USER_ID, CAMPAIGN_ID);
    expect(erroredResult).toEqual({ ok: false, error: { code: "unavailable" } });
    noSecret(erroredResult);

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseFavoriteRepository(thrown.client).remove(USER_ID, CAMPAIGN_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

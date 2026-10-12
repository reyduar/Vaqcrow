import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseOperatorProfileWriter } from "./supabase-operator-profile-writer.js";

/**
 * The Supabase operator profile writer (#390/WU5). It writes only
 * `profile.display_name` as `service_role`; a matched row is success, an
 * unmatched one is `not_found`, and every provider failure or throw is a
 * sanitized `unavailable` that never leaks `message`/`details`/`hint`.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";

interface DbResult {
  readonly data?: unknown;
  readonly error?: unknown;
}

interface Filter {
  readonly column: string;
  readonly value: unknown;
}

interface Op {
  table: string;
  action: "select" | "update";
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
      update(payload: unknown) {
        op.action = "update";
        op.payload = payload;
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

describe("SupabaseOperatorProfileWriter.setDisplayName", () => {
  it("updates display_name scoped to the user and reports success", async () => {
    const { client, ops } = fakeClient(() => ({ data: [{ user_id: USER_ID }], error: null }));

    const result = await new SupabaseOperatorProfileWriter(client).setDisplayName(USER_ID, "Ana Operadora");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(ops[0]?.table).toBe("profile");
    expect(ops[0]?.action).toBe("update");
    expect(ops[0]?.payload).toEqual({ display_name: "Ana Operadora" });
    expect(ops[0]?.filters).toEqual([{ column: "user_id", value: USER_ID }]);
  });

  it("answers not_found when the update matches no row", async () => {
    const { client } = fakeClient(() => ({ data: [], error: null }));

    expect(await new SupabaseOperatorProfileWriter(client).setDisplayName(USER_ID, "Ana")).toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("reports unavailable on a provider error or a throw, never leaking it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ data: null, error: pgError("42501") }));
    const erroredResult = await new SupabaseOperatorProfileWriter(errored.client).setDisplayName(USER_ID, "Ana");
    expect(erroredResult).toEqual({ ok: false, error: { code: "unavailable" } });
    noSecret(erroredResult);

    const malformed = fakeClient(() => ({ data: "not-an-array", error: null }));
    expect(await new SupabaseOperatorProfileWriter(malformed.client).setDisplayName(USER_ID, "Ana")).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseOperatorProfileWriter(thrown.client).setDisplayName(USER_ID, "Ana")).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseAdminUserWriter } from "./supabase-admin-user-writer.js";

/**
 * The Supabase admin-user writer (#390/WU3a). It reads `public.profile` and
 * writes only `status`/`role` as `service_role`; every provider failure is a
 * sanitized `unavailable` and never leaks `message`/`details`/`hint`.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";

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
  action: "select" | "update";
  columns?: string | undefined;
  options?: unknown;
  payload?: unknown;
  filters: Filter[];
  single: boolean;
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
      select(columns?: string, options?: unknown) {
        op.columns = columns;
        op.options = options;
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
      maybeSingle() {
        op.single = true;
        return run();
      },
      then(onFulfilled: (value: DbResult) => unknown, onRejected: (reason: unknown) => unknown) {
        return run().then(onFulfilled, onRejected);
      }
    };
    return builder;
  };

  const client = {
    from(table: string) {
      const op: Op = { table, action: "select", filters: [], single: false };
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

describe("SupabaseAdminUserWriter.findProfile", () => {
  it("reads one profile row by user_id", async () => {
    const { client, ops } = fakeClient(() => ({
      data: { user_id: USER_ID, role: "ADMIN", status: "active" },
      error: null
    }));

    const result = await new SupabaseAdminUserWriter(client).findProfile(USER_ID);

    expect(result).toEqual({ ok: true, value: { userId: USER_ID, role: "ADMIN", status: "active" } });
    expect(ops[0]?.table).toBe("profile");
    expect(ops[0]?.columns).toBe("user_id, role, status");
    expect(ops[0]?.filters).toEqual([{ column: "user_id", value: USER_ID }]);
    expect(ops[0]?.single).toBe(true);
  });

  it("answers not_found when no row matches", async () => {
    const { client } = fakeClient(() => ({ data: null, error: null }));

    expect(await new SupabaseAdminUserWriter(client).findProfile(USER_ID)).toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("reports unavailable and sanitizes a provider error or a throw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ data: null, error: pgError("42501") }));
    const erroredResult = await new SupabaseAdminUserWriter(errored.client).findProfile(USER_ID);
    expect(erroredResult).toEqual({ ok: false, error: { code: "unavailable" } });
    noSecret(erroredResult);

    const malformed = fakeClient(() => ({ data: { user_id: USER_ID, role: "NOPE", status: "active" }, error: null }));
    expect(await new SupabaseAdminUserWriter(malformed.client).findProfile(USER_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseAdminUserWriter(thrown.client).findProfile(USER_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

describe("SupabaseAdminUserWriter.countActiveAdmins", () => {
  it("counts active ADMIN profiles with an exact head count", async () => {
    const { client, ops } = fakeClient(() => ({ data: null, error: null, count: 2 }));

    const result = await new SupabaseAdminUserWriter(client).countActiveAdmins();

    expect(result).toEqual({ ok: true, value: 2 });
    expect(ops[0]?.options).toEqual({ count: "exact", head: true });
    expect(ops[0]?.filters).toEqual([
      { column: "role", value: "ADMIN" },
      { column: "status", value: "active" }
    ]);
  });

  it("reports unavailable on a missing exact count, a provider error or a throw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const noCount = fakeClient(() => ({ data: null, error: null, count: null }));
    expect(await new SupabaseAdminUserWriter(noCount.client).countActiveAdmins()).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });

    const errored = fakeClient(() => ({ data: null, error: pgError("42501"), count: null }));
    const erroredResult = await new SupabaseAdminUserWriter(errored.client).countActiveAdmins();
    expect(erroredResult).toEqual({ ok: false, error: { code: "unavailable" } });
    noSecret(erroredResult);

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseAdminUserWriter(thrown.client).countActiveAdmins()).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

describe("SupabaseAdminUserWriter.setActive", () => {
  it("updates status scoped to the user and reports success", async () => {
    const { client, ops } = fakeClient((op) => (op.action === "update" ? { data: [{ user_id: USER_ID }], error: null } : { data: null, error: null }));

    const result = await new SupabaseAdminUserWriter(client).setActive(USER_ID, false);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(ops[0]?.action).toBe("update");
    expect(ops[0]?.payload).toEqual({ status: "inactive" });
    expect(ops[0]?.filters).toEqual([{ column: "user_id", value: USER_ID }]);
  });

  it("answers not_found when the update matches no row", async () => {
    const { client } = fakeClient(() => ({ data: [], error: null }));

    expect(await new SupabaseAdminUserWriter(client).setActive(USER_ID, true)).toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("reports unavailable on a provider error or a throw, never leaking it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ data: null, error: pgError("42501") }));
    const erroredResult = await new SupabaseAdminUserWriter(errored.client).setActive(USER_ID, true);
    expect(erroredResult).toEqual({ ok: false, error: { code: "unavailable" } });
    noSecret(erroredResult);

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseAdminUserWriter(thrown.client).setActive(USER_ID, true)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

describe("SupabaseAdminUserWriter.setRole", () => {
  it("updates role scoped to the user and reports success", async () => {
    const { client, ops } = fakeClient((op) => (op.action === "update" ? { data: [{ user_id: USER_ID }], error: null } : { data: null, error: null }));

    const result = await new SupabaseAdminUserWriter(client).setRole(USER_ID, "INVERSOR");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(ops[0]?.payload).toEqual({ role: "INVERSOR" });
    expect(ops[0]?.filters).toEqual([{ column: "user_id", value: USER_ID }]);
  });

  it("answers not_found when the update matches no row", async () => {
    const { client } = fakeClient(() => ({ data: [], error: null }));

    expect(await new SupabaseAdminUserWriter(client).setRole(USER_ID, "PYME")).toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("reports unavailable on a provider error or a throw, never leaking it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ data: null, error: pgError("42501") }));
    const erroredResult = await new SupabaseAdminUserWriter(errored.client).setRole(USER_ID, "PYME");
    expect(erroredResult).toEqual({ ok: false, error: { code: "unavailable" } });
    noSecret(erroredResult);

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseAdminUserWriter(thrown.client).setRole(USER_ID, "PYME")).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

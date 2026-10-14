import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseAssistantAccess } from "./supabase-assistant-access.js";

/**
 * The Supabase assistant access adapter (#499/WU2). It reads the per-user
 * `profile.chat_enabled` flag and counts/records `public.assistant_question`
 * rows for the rolling window, as `service_role`. Every provider failure is a
 * sanitized `unavailable`; `message`/`details`/`hint` never cross the boundary.
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
  action: "select" | "insert";
  columns?: string | undefined;
  options?: unknown;
  payload?: unknown;
  filters: Filter[];
  single: boolean;
}

type Handler = (op: Op) => DbResult | Promise<DbResult>;

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
      insert(payload: unknown) {
        op.action = "insert";
        op.payload = payload;
        return builder;
      },
      eq(column: string, value: unknown) {
        op.filters.push({ column, value });
        return builder;
      },
      gte(column: string, value: unknown) {
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

const pgError = (code: string) => ({ code, message: "SECRET message", details: "SECRET details", hint: "SECRET hint" });
const noSecret = (value: unknown) => {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("SECRET");
};

afterEach(() => vi.restoreAllMocks());

describe("SupabaseAssistantAccess.isChatEnabled", () => {
  it("reads the flag for the user", async () => {
    const { client, ops } = fakeClient(() => ({ data: { chat_enabled: true }, error: null }));

    expect(await new SupabaseAssistantAccess(client).isChatEnabled(USER_ID)).toEqual({ ok: true, value: true });
    expect(ops[0]?.table).toBe("profile");
    expect(ops[0]?.columns).toBe("chat_enabled");
    expect(ops[0]?.filters).toEqual([{ column: "user_id", value: USER_ID }]);
    expect(ops[0]?.single).toBe(true);
  });

  it("defaults to false when no profile row is found", async () => {
    const { client } = fakeClient(() => ({ data: null, error: null }));
    expect(await new SupabaseAssistantAccess(client).isChatEnabled(USER_ID)).toEqual({ ok: true, value: false });
  });

  it("answers unavailable for a malformed row, a provider error or a throw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const malformed = fakeClient(() => ({ data: { chat_enabled: "yes" }, error: null }));
    expect(await new SupabaseAssistantAccess(malformed.client).isChatEnabled(USER_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });

    const errored = fakeClient(() => ({ data: null, error: pgError("42501") }));
    const erroredResult = await new SupabaseAssistantAccess(errored.client).isChatEnabled(USER_ID);
    expect(erroredResult).toEqual({ ok: false, error: { code: "unavailable" } });
    noSecret(erroredResult);
  });
});

describe("SupabaseAssistantAccess.countRecentQuestions", () => {
  it("counts the window with an exact head count on the user and asked_at bound", async () => {
    const { client, ops } = fakeClient(() => ({ data: null, error: null, count: 3 }));
    const since = new Date("2026-10-13T12:00:00.000Z");

    expect(await new SupabaseAssistantAccess(client).countRecentQuestions(USER_ID, since)).toEqual({ ok: true, value: 3 });
    expect(ops[0]?.table).toBe("assistant_question");
    expect(ops[0]?.options).toEqual({ count: "exact", head: true });
    expect(ops[0]?.filters).toEqual([
      { column: "user_id", value: USER_ID },
      { column: "asked_at", value: since.toISOString() }
    ]);
  });

  it("answers unavailable on a missing count or a provider error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const noCount = fakeClient(() => ({ data: null, error: null, count: null }));
    expect(await new SupabaseAssistantAccess(noCount.client).countRecentQuestions(USER_ID, new Date())).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });

    const errored = fakeClient(() => ({ data: null, error: pgError("42501"), count: null }));
    expect(await new SupabaseAssistantAccess(errored.client).countRecentQuestions(USER_ID, new Date())).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

describe("SupabaseAssistantAccess.recordQuestion", () => {
  it("inserts one timestamped row for the user", async () => {
    const { client, ops } = fakeClient(() => ({ data: null, error: null }));
    const at = new Date("2026-10-14T12:00:00.000Z");

    expect(await new SupabaseAssistantAccess(client).recordQuestion(USER_ID, at)).toEqual({ ok: true, value: undefined });
    expect(ops[0]?.table).toBe("assistant_question");
    expect(ops[0]?.action).toBe("insert");
    expect(ops[0]?.payload).toEqual({ user_id: USER_ID, asked_at: at.toISOString() });
  });

  it("answers unavailable on a provider error or a throw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ data: null, error: pgError("42501") }));
    const erroredResult = await new SupabaseAssistantAccess(errored.client).recordQuestion(USER_ID, new Date());
    expect(erroredResult).toEqual({ ok: false, error: { code: "unavailable" } });
    noSecret(erroredResult);

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseAssistantAccess(thrown.client).recordQuestion(USER_ID, new Date())).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

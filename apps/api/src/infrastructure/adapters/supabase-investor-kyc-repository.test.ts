import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseInvestorKycRepository } from "./supabase-investor-kyc-repository.js";

/**
 * The Supabase investor-KYC adapter (#422/WU4). It reads/writes through the
 * service_role client and scopes every query by the caller's `user_id`. A
 * missing record is `ok` with `null` (not a failure), a `23505` on insert is an
 * idempotent replay (re-read, `created: false`) and every other failure is a
 * sanitized `unavailable` that never leaks provider text.
 */
const USER_ID = "00000000-0000-4000-8000-000000000002";
const APPROVED_AT = "2026-10-08T18:30:00.000Z";

interface Op {
  table: string;
  action: "select" | "insert";
  columns?: string | undefined;
  payload?: unknown;
  filters: Array<{ column: string; value: unknown }>;
}

interface DbResult {
  readonly data?: unknown;
  readonly error?: unknown;
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SupabaseInvestorKycRepository.find", () => {
  it("returns the caller's stored record", async () => {
    const { client, ops } = fakeClient(() => ({ data: [{ approved_at: APPROVED_AT, simulado: true }] }));
    const repository = new SupabaseInvestorKycRepository(client);

    const result = await repository.find(USER_ID);

    expect(result).toEqual({ ok: true, value: { approvedAt: APPROVED_AT, simulado: true } });
    expect(ops[0]!.table).toBe("investor_kyc");
    expect(ops[0]!.action).toBe("select");
    expect(ops[0]!.filters).toEqual([{ column: "user_id", value: USER_ID }]);
  });

  it("is ok with null when there is no record", async () => {
    const { client } = fakeClient(() => ({ data: [] }));
    const repository = new SupabaseInvestorKycRepository(client);

    expect(await repository.find(USER_ID)).toEqual({ ok: true, value: null });
  });

  it("maps a provider error to unavailable without leaking it", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient(() => ({ error: { code: "42P01", message: "relation does not exist", details: null, hint: null } }));
    const repository = new SupabaseInvestorKycRepository(client);

    const result = await repository.find(USER_ID);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("relation does not exist");
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed row instead of inventing a record", async () => {
    const { client } = fakeClient(() => ({ data: [{ approved_at: 42, simulado: true }] }));
    const repository = new SupabaseInvestorKycRepository(client);

    expect(await repository.find(USER_ID)).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

describe("SupabaseInvestorKycRepository.approve", () => {
  it("inserts the caller's row and reports creation", async () => {
    const { client, ops } = fakeClient(() => ({ data: [{ approved_at: APPROVED_AT, simulado: true }] }));
    const repository = new SupabaseInvestorKycRepository(client);

    const result = await repository.approve(USER_ID);

    expect(result).toEqual({ ok: true, value: { approvedAt: APPROVED_AT, simulado: true, created: true } });
    expect(ops[0]!.action).toBe("insert");
    expect(ops[0]!.payload).toEqual({ user_id: USER_ID });
  });

  it("is idempotent: a unique violation re-reads the existing record", async () => {
    let calls = 0;
    const { client } = fakeClient((op) => {
      calls += 1;
      if (op.action === "insert") {
        return { error: { code: "23505", message: "duplicate key", details: null, hint: null } };
      }
      return { data: [{ approved_at: APPROVED_AT, simulado: true }] };
    });
    const repository = new SupabaseInvestorKycRepository(client);

    const result = await repository.approve(USER_ID);

    expect(calls).toBe(2);
    expect(result).toEqual({ ok: true, value: { approvedAt: APPROVED_AT, simulado: true, created: false } });
  });

  it("maps any other insert error to unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient(() => ({ error: { code: "23503", message: "fk violation", details: null, hint: null } }));
    const repository = new SupabaseInvestorKycRepository(client);

    expect(await repository.approve(USER_ID)).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("is unavailable when the re-read after a conflict finds nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient((op) =>
      op.action === "insert"
        ? { error: { code: "23505", message: "duplicate key", details: null, hint: null } }
        : { data: [] }
    );
    const repository = new SupabaseInvestorKycRepository(client);

    expect(await repository.approve(USER_ID)).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

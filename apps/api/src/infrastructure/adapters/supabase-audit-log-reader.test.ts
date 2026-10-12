import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseAuditLogReader } from "./supabase-audit-log-reader.js";

/**
 * The ADMIN audit-log read adapter (#390, WU2). It reads `audit_log` newest
 * first with `range` pagination and an exact `count`, resolves the actor name
 * from `profile`, derives a factual summary, and turns `search` into a
 * sanitized PostgREST filter. A provider error, a missing count, an unresolved
 * actor or a malformed row is `unavailable`; provider text never reaches the
 * caller.
 */
const ACTOR_ID = "00000000-0000-4000-8000-000000000005";
const ENTRY_ID = "44444444-4444-4444-8444-444444444444";

const AUDIT_ROW = {
  id: ENTRY_ID,
  actor_user_id: ACTOR_ID,
  action: "admin.operator_invited",
  target_type: "operator",
  target_id: "op@vaqcrow.com",
  created_at: "2026-10-12T13:00:00.000Z"
};
const PROFILE_ROW = { user_id: ACTOR_ID, display_name: "Admin Vaqcrow" };

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly count?: number | null;
  readonly reject?: Error;
}

function fakeClient(perTable: Record<string, FakeStep>): {
  client: SupabaseClient;
  or: string[];
  range: Array<readonly [number, number]>;
  inCalls: Array<readonly [string, unknown]>;
  order: Array<readonly [string, unknown]>;
} {
  const or: string[] = [];
  const range: Array<readonly [number, number]> = [];
  const inCalls: Array<readonly [string, unknown]> = [];
  const order: Array<readonly [string, unknown]> = [];

  const client = {
    from: (table: string) => {
      const step = perTable[table] ?? { data: [] };
      const builder: Record<string, unknown> = {};
      builder["select"] = () => builder;
      builder["order"] = (column: string, options: unknown) => {
        order.push([column, options]);
        return builder;
      };
      builder["or"] = (filter: string) => {
        or.push(filter);
        return builder;
      };
      builder["range"] = (first: number, last: number) => {
        range.push([first, last]);
        return builder;
      };
      builder["in"] = (column: string, values: unknown) => {
        inCalls.push([column, values]);
        return builder;
      };
      builder["then"] = (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const settled = step.reject
          ? Promise.reject(step.reject)
          : Promise.resolve({ data: step.data ?? null, error: step.error ?? null, count: step.count ?? null });
        return settled.then(onFulfilled, onRejected);
      };
      return builder;
    }
  } as unknown as SupabaseClient;

  return { client, or, range, inCalls, order };
}

function tables(overrides: Record<string, FakeStep> = {}): Record<string, FakeStep> {
  return {
    audit_log: { data: [AUDIT_ROW], count: 1 },
    profile: { data: [PROFILE_ROW] },
    ...overrides
  };
}

describe("SupabaseAuditLogReader", () => {
  it("reads newest first with range and an exact count, resolving the actor and summary", async () => {
    const { client, order, range, inCalls } = fakeClient(tables());

    const result = await new SupabaseAuditLogReader(client).list({ page: 1, pageSize: 20 });

    expect(order).toEqual([["created_at", { ascending: false }]]);
    expect(range).toEqual([[0, 19]]);
    expect(inCalls).toEqual([["user_id", [ACTOR_ID]]]);
    expect(result).toEqual({
      ok: true,
      value: {
        items: [
          {
            id: ENTRY_ID,
            occurredAt: "2026-10-12T13:00:00.000Z",
            actorUserId: ACTOR_ID,
            actorDisplayName: "Admin Vaqcrow",
            action: "admin.operator_invited",
            targetType: "operator",
            targetId: "op@vaqcrow.com",
            summary: "admin.operator_invited · operator"
          }
        ],
        total: 1,
        page: 1,
        pageSize: 20
      }
    });
  });

  it("computes the page range from page and pageSize", async () => {
    const { client, range } = fakeClient(tables({ audit_log: { data: [], count: 0 } }));

    await new SupabaseAuditLogReader(client).list({ page: 3, pageSize: 10 });

    expect(range).toEqual([[20, 29]]);
  });

  it("turns search into a sanitized or/ilike filter over the summary's source columns", async () => {
    const { client, or } = fakeClient(tables());

    await new SupabaseAuditLogReader(client).list({ search: "invited", page: 1, pageSize: 20 });
    expect(or).toEqual(["action.ilike.*invited*,target_type.ilike.*invited*,target_id.ilike.*invited*"]);

    const sanitized = fakeClient(tables());
    await new SupabaseAuditLogReader(sanitized.client).list({ search: 'a,()*%"b', page: 1, pageSize: 20 });
    expect(sanitized.or).toEqual(["action.ilike.*a b*,target_type.ilike.*a b*,target_id.ilike.*a b*"]);
  });

  it("reports unavailable on a provider error, never leaking its text", async () => {
    const { client } = fakeClient(
      tables({ audit_log: { error: { code: "PGRST500", message: "secret detail", details: "d", hint: "h" } } })
    );

    const result = await new SupabaseAuditLogReader(client).list({ page: 1, pageSize: 20 });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("secret detail");
  });

  it("reports unavailable when the exact count is missing or a row is malformed", async () => {
    const noCount = fakeClient(tables({ audit_log: { data: [AUDIT_ROW], count: null } }));
    const malformed = fakeClient(tables({ audit_log: { data: [{ ...AUDIT_ROW, target_id: null }], count: 1 } }));

    expect(await new SupabaseAuditLogReader(noCount.client).list({ page: 1, pageSize: 20 })).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    expect(await new SupabaseAuditLogReader(malformed.client).list({ page: 1, pageSize: 20 })).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("reports unavailable for an unresolved actor or a profile read failure", async () => {
    const missingActor = fakeClient(tables({ profile: { data: [] } }));
    const profileFails = fakeClient(
      tables({ profile: { error: { code: "PGRST500", message: "secret detail", details: "d", hint: "h" } } })
    );

    expect(await new SupabaseAuditLogReader(missingActor.client).list({ page: 1, pageSize: 20 })).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    const failed = await new SupabaseAuditLogReader(profileFails.client).list({ page: 1, pageSize: 20 });
    expect(failed).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(failed)).not.toContain("secret detail");
  });

  it("does not join profiles for an empty page", async () => {
    const { client, inCalls } = fakeClient(tables({ audit_log: { data: [], count: 0 } }));

    const result = await new SupabaseAuditLogReader(client).list({ page: 1, pageSize: 20 });

    expect(inCalls).toEqual([]);
    expect(result).toEqual({ ok: true, value: { items: [], total: 0, page: 1, pageSize: 20 } });
  });
});

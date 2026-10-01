import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseAuditLog } from "./supabase-audit-log.js";

function fakeClient(step: { error?: { code: string; message: string; details: string; hint: string } | null; reject?: Error }) {
  const inserts: Array<readonly [string, unknown]> = [];
  const client = {
    from: (table: string) => ({
      insert: (row: unknown) => {
        inserts.push([table, row]);
        return step.reject ? Promise.reject(step.reject) : Promise.resolve({ error: step.error ?? null });
      }
    })
  } as unknown as SupabaseClient;
  return { client, inserts };
}

afterEach(() => vi.restoreAllMocks());

describe("SupabaseAuditLog.append", () => {
  it("inserts one audit_log row mapped to snake_case columns", async () => {
    const { client, inserts } = fakeClient({});

    const result = await new SupabaseAuditLog(client).append({
      actorUserId: "u1",
      action: "decision.recorded",
      targetType: "application",
      targetId: "a1",
      detail: { outcome: "approved" },
      correlationId: "c1"
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(inserts).toEqual([
      [
        "audit_log",
        {
          actor_user_id: "u1",
          action: "decision.recorded",
          target_type: "application",
          target_id: "a1",
          detail: { outcome: "approved" },
          correlation_id: "c1"
        }
      ]
    ]);
  });

  it("omits optional columns so the database defaults apply", async () => {
    const { client, inserts } = fakeClient({});

    await new SupabaseAuditLog(client).append({ actorUserId: "u1", action: "x", targetType: "t", targetId: "i" });

    expect(inserts[0]?.[1]).toEqual({ actor_user_id: "u1", action: "x", target_type: "t", target_id: "i" });
  });

  it("answers unavailable on a database error without leaking message, details or hint", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ error: { code: "23503", message: "secret", details: "d", hint: "h" } });

    const result = await new SupabaseAuditLog(client).append({
      actorUserId: "u1",
      action: "x",
      targetType: "t",
      targetId: "i"
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(error).toHaveBeenCalled();
  });

  it("answers unavailable when the insert rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ reject: new Error("network") });
    expect(
      await new SupabaseAuditLog(client).append({ actorUserId: "u1", action: "x", targetType: "t", targetId: "i" })
    ).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

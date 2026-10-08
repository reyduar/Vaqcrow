import type { SupabaseClient } from "@supabase/supabase-js";
import { parseApplicationId } from "@vaqcrow/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetDocumentVerdictInput } from "../../application/ports/document-verdict-repository-port.js";
import { SupabaseDocumentVerdictRepository } from "./supabase-document-verdict-repository.js";

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const DOCUMENT_ID = "55555555-5555-4555-8555-555555555555";
const ADMIN_ID = "00000000-0000-4000-8000-000000000005";

const ROW = {
  application_id: APPLICATION_ID,
  document_id: DOCUMENT_ID,
  verdict: "valid",
  actor: "Admin Vaqcrow",
  actor_user_id: ADMIN_ID,
  created_at: "2026-10-07T12:00:00.000Z",
  updated_at: "2026-10-07T12:00:00.000Z"
};

const RECORD = {
  documentId: DOCUMENT_ID,
  verdict: "valid",
  actor: "Admin Vaqcrow",
  updatedAt: "2026-10-07T12:00:00.000Z"
} as const;

const INPUT: SetDocumentVerdictInput = {
  applicationId: APPLICATION_ID,
  documentId: DOCUMENT_ID,
  verdict: "valid",
  actor: "Admin Vaqcrow",
  actorUserId: ADMIN_ID
};

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

/**
 * A terminal-step queue: `single()`/`maybeSingle()` and an awaited `order()`
 * each pop the next step, so a method that inserts, then updates, then reads is
 * exercised against the real sequence of round trips.
 */
function fakeClient(steps: readonly FakeStep[]) {
  const calls = {
    from: [] as string[],
    insert: [] as unknown[],
    update: [] as unknown[],
    eq: [] as Array<readonly [string, unknown]>,
    neq: [] as Array<readonly [string, unknown]>,
    order: [] as Array<readonly [string, unknown]>
  };
  let cursor = 0;

  function terminal(): Promise<{ data: unknown; error: unknown }> {
    const step = steps[cursor] ?? {};
    cursor += 1;
    return step.reject
      ? Promise.reject(step.reject)
      : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });
  }

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
    neq: (column: string, value: unknown) => {
      calls.neq.push([column, value]);
      return builder;
    },
    order: (column: string, options: unknown) => {
      calls.order.push([column, options]);
      return terminal();
    },
    single: () => terminal(),
    maybeSingle: () => terminal()
  };

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

describe("SupabaseDocumentVerdictRepository.listByApplication", () => {
  it("scopes the read to the application and maps every row to the read shape", async () => {
    const second = { ...ROW, document_id: "66666666-6666-4666-8666-666666666666", verdict: "request" };
    const { client, calls } = fakeClient([{ data: [ROW, second] }]);

    const result = await new SupabaseDocumentVerdictRepository(client).listByApplication(APPLICATION_ID);

    expect(calls.from).toEqual(["document_verdict"]);
    expect(calls.eq).toEqual([["application_id", APPLICATION_ID]]);
    expect(result).toEqual({
      ok: true,
      value: [RECORD, { ...RECORD, documentId: second.document_id, verdict: "request" }]
    });
  });

  it("returns an empty list when no verdict was set", async () => {
    const { client } = fakeClient([{ data: [] }]);

    await expect(new SupabaseDocumentVerdictRepository(client).listByApplication(APPLICATION_ID)).resolves.toEqual({
      ok: true,
      value: []
    });
  });

  it("is unavailable on a Postgres error, a malformed row or a rejected call, leaking no text", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [
      { error: pgError("XX000") },
      { data: [{ ...ROW, verdict: "approved" }] },
      { data: [{ ...ROW, actor: 42 }] },
      { data: "not-a-list" },
      { reject: new Error("network SECRET") }
    ] as const) {
      const { client } = fakeClient([step]);
      const result = await new SupabaseDocumentVerdictRepository(client).listByApplication(APPLICATION_ID);
      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
      expect(JSON.stringify(result)).not.toContain("SECRET");
    }
  });
});

describe("SupabaseDocumentVerdictRepository.setVerdict", () => {
  it("inserts the first verdict with the verified actor and reports it applied", async () => {
    const { client, calls } = fakeClient([{ data: ROW }]);

    const result = await new SupabaseDocumentVerdictRepository(client).setVerdict(INPUT);

    expect(calls.insert).toEqual([
      {
        application_id: APPLICATION_ID,
        document_id: DOCUMENT_ID,
        verdict: "valid",
        actor: "Admin Vaqcrow",
        actor_user_id: ADMIN_ID
      }
    ]);
    expect(calls.update).toHaveLength(0);
    expect(result).toEqual({ ok: true, value: { applied: true, verdict: RECORD } });
  });

  it("updates an existing verdict only when the stored value differs", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const changed = { ...ROW, verdict: "invalid", actor: "Otra Admin", updated_at: "2026-10-07T12:05:00.000Z" };
    const { client, calls } = fakeClient([{ error: pgError("23505") }, { data: changed }]);

    const result = await new SupabaseDocumentVerdictRepository(client).setVerdict({
      ...INPUT,
      verdict: "invalid",
      actor: "Otra Admin"
    });

    expect(calls.update).toEqual([{ verdict: "invalid", actor: "Otra Admin", actor_user_id: ADMIN_ID }]);
    expect(calls.eq).toEqual([
      ["application_id", APPLICATION_ID],
      ["document_id", DOCUMENT_ID]
    ]);
    expect(calls.neq).toEqual([["verdict", "invalid"]]);
    expect(result).toEqual({
      ok: true,
      value: {
        applied: true,
        verdict: { ...RECORD, verdict: "invalid", actor: "Otra Admin", updatedAt: changed.updated_at }
      }
    });
  });

  it("is a no-op replay when the stored verdict already has this value", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, calls } = fakeClient([{ error: pgError("23505") }, { data: null }, { data: ROW }]);

    const result = await new SupabaseDocumentVerdictRepository(client).setVerdict(INPUT);

    expect(calls.insert).toHaveLength(1);
    expect(calls.update).toHaveLength(1);
    expect(result).toEqual({ ok: true, value: { applied: false, verdict: RECORD } });
  });

  it("maps a foreign-key violation to not_found", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient([{ error: pgError("23503") }]);

    const result = await new SupabaseDocumentVerdictRepository(client).setVerdict(INPUT);

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });

  it("is unavailable for any other error, a malformed row or a vanished row, leaking no text", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const scenarios: ReadonlyArray<readonly FakeStep[]> = [
      [{ error: pgError("42501") }],
      [{ reject: new Error("network SECRET") }],
      [{ data: { ...ROW, updated_at: 7 } }],
      [{ error: pgError("23505") }, { error: pgError("XX000") }],
      [{ error: pgError("23505") }, { data: null }, { data: null }],
      [{ error: pgError("23505") }, { data: null }, { error: pgError("XX000") }]
    ];
    for (const steps of scenarios) {
      const { client } = fakeClient(steps);
      const result = await new SupabaseDocumentVerdictRepository(client).setVerdict(INPUT);
      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
      expect(JSON.stringify(result)).not.toContain("SECRET");
    }
  });
});

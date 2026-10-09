import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import type { SmeRequest } from "@vaqcrow/contracts";
import { ADMIN_QUEUE_RAW_STATES_BY_DISPLAY } from "../../application/ports/sme-request-repository-port.js";
import { SupabaseSmeRequestRepository } from "./supabase-sme-request-repository.js";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const OWNER = "e1111111-1111-4111-8111-111111111111";

const REQUEST: SmeRequest = {
  smeReference: "sme:SYN-PH-0001",
  declaredTotalArs: 15_000_000,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

const ROW = {
  application_id: APPLICATION_ID,
  sme_reference: "sme:SYN-PH-0001",
  declared_total_ars: 15000000,
  period_start: "2026-01",
  period_end: "2026-08",
  correlation_id: CORRELATION_ID,
  owner_user_id: OWNER
};

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

function fakeClient(step: FakeStep): {
  client: SupabaseClient;
  rpc: Array<readonly [string, unknown]>;
  eq: Array<readonly [string, unknown]>;
  order: Array<readonly [string, unknown]>;
  from: string[];
} {
  const rpc: Array<readonly [string, unknown]> = [];
  const eq: Array<readonly [string, unknown]> = [];
  const order: Array<readonly [string, unknown]> = [];
  const from: string[] = [];
  const result = () =>
    step.reject ? Promise.reject(step.reject) : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });
  // Supabase's builder is thenable, so an awaited `select().eq().order()` chain
  // resolves through `then` exactly as `maybeSingle()` would.
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
    maybeSingle: () => result(),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      result().then(onFulfilled, onRejected)
  };
  return {
    client: {
      from: (table: string) => {
        from.push(table);
        return builder;
      },
      rpc: (name: string, params: unknown) => {
        rpc.push([name, params]);
        return result();
      }
    } as unknown as SupabaseClient,
    rpc,
    eq,
    order,
    from
  };
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

describe("SupabaseSmeRequestRepository.submit", () => {
  it("calls the atomic function with the request columns and maps an applied row", async () => {
    const { client, rpc } = fakeClient({ data: [{ result_kind: "applied", ...ROW }] });

    const result = await new SupabaseSmeRequestRepository(client).submit({
      applicationId: APPLICATION_ID,
      request: REQUEST,
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

    expect(rpc).toEqual([
      [
        "submit_sme_request",
        {
          p_application_id: APPLICATION_ID,
          p_correlation_id: CORRELATION_ID,
          p_sme_reference: "sme:SYN-PH-0001",
          p_declared_total_ars: 15_000_000,
          p_period_start: "2026-01",
          p_period_end: "2026-08",
          p_owner_user_id: OWNER
        }
      ]
    ]);
    expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, request: REQUEST, applied: true, ownerUserId: OWNER } });
  });

  it("returns the stored application on a replay, with the numeric total arriving as a string", async () => {
    const otherId = "99999999-9999-4999-8999-999999999999";
    const { client } = fakeClient({
      data: [{ result_kind: "replayed", ...ROW, application_id: otherId, declared_total_ars: "15000000" }]
    });

    const result = await new SupabaseSmeRequestRepository(client).submit({
      applicationId: APPLICATION_ID,
      request: REQUEST,
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

    expect(result).toEqual({ ok: true, value: { applicationId: otherId, request: REQUEST, applied: false, ownerUserId: OWNER } });
  });

  it.each([
    ["check violation", "23514", "invalid_request"],
    ["unique violation on a colliding id", "23505", "unavailable"],
    ["permission denied", "42501", "unavailable"]
  ] as const)("maps %s to a sanitized %s error without leaking Postgres text", async (_name, code, expected) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ error: pgError(code) });

    const result = await new SupabaseSmeRequestRepository(client).submit({
      applicationId: APPLICATION_ID,
      request: REQUEST,
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

    expect(result).toEqual({ ok: false, error: { code: expected } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(consoleError).toHaveBeenCalled();
  });

  it("is unavailable for a malformed rpc payload, an unknown kind or a thrown client error", async () => {
    for (const step of [
      { data: [] },
      { data: [{ result_kind: "weird", ...ROW }] },
      { data: [{ result_kind: "applied", ...ROW, period_start: "bad" }] },
      { reject: new Error("network SECRET") }
    ] as const) {
      const { client } = fakeClient(step);
      const result = await new SupabaseSmeRequestRepository(client).submit({
        applicationId: APPLICATION_ID,
        request: REQUEST,
        correlationId: CORRELATION_ID,
        ownerUserId: OWNER
      });
      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    }
  });
});

describe("SupabaseSmeRequestRepository.findByApplicationId", () => {
  it("reads the request row by application id", async () => {
    const { client, eq, from } = fakeClient({ data: ROW });

    const result = await new SupabaseSmeRequestRepository(client).findByApplicationId(APPLICATION_ID);

    expect(from).toEqual(["sme_request"]);
    expect(eq).toEqual([["application_id", APPLICATION_ID]]);
    expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, request: REQUEST, ownerUserId: OWNER } });
  });

  it("is not_found when no row exists", async () => {
    const { client } = fakeClient({ data: null });

    expect(await new SupabaseSmeRequestRepository(client).findByApplicationId(APPLICATION_ID)).toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("is unavailable on a Postgres error or a malformed stored row", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [{ error: pgError("XX000") }, { data: { ...ROW, declared_total_ars: "abc" } }]) {
      const { client } = fakeClient(step);
      expect(await new SupabaseSmeRequestRepository(client).findByApplicationId(APPLICATION_ID)).toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
    }
  });
});

describe("SupabaseSmeRequestRepository.findReviewStateByApplicationId", () => {
  it("reads the application_review state by application id", async () => {
    const { client, eq, from } = fakeClient({ data: { state: "human_review" } });

    const result = await new SupabaseSmeRequestRepository(client).findReviewStateByApplicationId(APPLICATION_ID);

    expect(from).toEqual(["application_review"]);
    expect(eq).toEqual([["application_id", APPLICATION_ID]]);
    expect(result).toEqual({ ok: true, value: "human_review" });
  });

  it("is not_found when no review row exists", async () => {
    const { client } = fakeClient({ data: null });

    expect(await new SupabaseSmeRequestRepository(client).findReviewStateByApplicationId(APPLICATION_ID)).toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("is unavailable on a Postgres error or a state outside the contract", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [{ error: pgError("XX000") }, { data: { state: "not_a_state" } }]) {
      const { client } = fakeClient(step);
      expect(await new SupabaseSmeRequestRepository(client).findReviewStateByApplicationId(APPLICATION_ID)).toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
    }
  });
});

describe("SupabaseSmeRequestRepository.findByOwner", () => {
  it("reads the owner's requests newest first and maps them", async () => {
    const { client, eq, order, from } = fakeClient({ data: [ROW] });

    const result = await new SupabaseSmeRequestRepository(client).findByOwner(OWNER);

    expect(from).toEqual(["sme_request"]);
    expect(eq).toEqual([["owner_user_id", OWNER]]);
    expect(order).toEqual([["created_at", { ascending: false }]]);
    expect(result).toEqual({
      ok: true,
      value: [{ applicationId: APPLICATION_ID, request: REQUEST, ownerUserId: OWNER }]
    });
  });

  it("returns an empty list when the owner has no requests", async () => {
    const { client } = fakeClient({ data: [] });

    expect(await new SupabaseSmeRequestRepository(client).findByOwner(OWNER)).toEqual({ ok: true, value: [] });
  });

  it("is unavailable on a Postgres error, a null payload or a malformed stored row", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [{ error: pgError("XX000") }, { data: null }, { data: [{ ...ROW, declared_total_ars: "abc" }] }]) {
      const { client } = fakeClient(step);
      expect(await new SupabaseSmeRequestRepository(client).findByOwner(OWNER)).toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
    }
  });
});

interface QueueCall {
  readonly table: string;
  readonly select: Array<readonly [string, unknown]>;
  readonly order: Array<readonly [string, unknown]>;
  readonly or: string[];
  readonly in: Array<readonly [string, readonly unknown[]]>;
  readonly range: Array<readonly [number, number]>;
}

interface QueueStep {
  readonly data?: unknown;
  readonly count?: number | null;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

interface QueueCountStep {
  readonly counts?: Readonly<Record<string, number>>;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

interface QueueBuilder {
  select(columns: string, options?: unknown): QueueBuilder;
  order(column: string, options?: unknown): QueueBuilder;
  or(filter: string): QueueBuilder;
  in(column: string, values: readonly unknown[]): QueueBuilder;
  range(first: number, last: number): Promise<unknown>;
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
}

const DISPLAY_BY_RAW_STATES: ReadonlyMap<string, string> = new Map(
  (Object.entries(ADMIN_QUEUE_RAW_STATES_BY_DISPLAY) as Array<[string, readonly string[]]>).map(
    ([display, states]) => [states.join(","), display]
  )
);

/**
 * A fake PostgREST client for the queue: the page query (no `head`) settles on
 * `.range`, while the four global count queries (`head: true`, one per display
 * group) settle when awaited and answer from `countStep.counts` keyed by the
 * display group their `in` filter selects.
 */
function fakeQueueClient(
  step: QueueStep,
  countStep: QueueCountStep = {}
): { client: SupabaseClient; calls: QueueCall[] } {
  const calls: QueueCall[] = [];
  const client = {
    from: (table: string): QueueBuilder => {
      const call: QueueCall = { table, select: [], order: [], or: [], in: [], range: [] };
      calls.push(call);
      const isCount = () => Boolean((call.select[0]?.[1] as { head?: boolean } | undefined)?.head);
      const settle = () => {
        if (isCount()) {
          if (countStep.reject) return Promise.reject(countStep.reject);
          if (countStep.error) return Promise.resolve({ data: null, error: countStep.error, count: null });
          const display = DISPLAY_BY_RAW_STATES.get((call.in[0]?.[1] ?? []).join(","));
          return Promise.resolve({ data: null, error: null, count: countStep.counts?.[display ?? ""] ?? 0 });
        }
        if (step.reject) return Promise.reject(step.reject);
        return Promise.resolve({ data: step.data ?? null, error: step.error ?? null, count: step.count ?? null });
      };
      const builder: QueueBuilder = {
        select: (columns, options) => {
          call.select.push([columns, options]);
          return builder;
        },
        order: (column, options) => {
          call.order.push([column, options]);
          return builder;
        },
        or: (filter) => {
          call.or.push(filter);
          return builder;
        },
        in: (column, values) => {
          call.in.push([column, values]);
          return builder;
        },
        range: (first, last) => {
          call.range.push([first, last]);
          return settle();
        },
        then: (onfulfilled, onrejected) => settle().then(onfulfilled, onrejected)
      };
      return builder;
    }
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("SupabaseSmeRequestRepository.listAdminQueue", () => {
  const QUEUE_ROW = {
    application_id: "11111111-1111-4111-8111-111111111111",
    name: "Panadería Sol",
    sector: "Alimentos",
    state: "human_review",
    updated_at: "2026-10-04T12:00:00.000Z"
  };
  const COUNTS = { pending: 3, changes: 1, approved: 2, rejected: 4 };

  it("reads the joined view with server-side order/range and global display counts", async () => {
    const { client, calls } = fakeQueueClient({ data: [QUEUE_ROW], count: 1 }, { counts: COUNTS });

    const result = await new SupabaseSmeRequestRepository(client).listAdminQueue({
      page: 2,
      pageSize: 20,
      sort: "name",
      order: "asc"
    });

    expect(calls.map((call) => call.table)).toEqual([
      "admin_sme_request_queue",
      "admin_sme_request_queue",
      "admin_sme_request_queue",
      "admin_sme_request_queue",
      "admin_sme_request_queue"
    ]);

    const page = calls[0]!;
    expect(page.select).toEqual([["*", { count: "exact" }]]);
    expect(page.order).toEqual([["name", { ascending: true }]]);
    expect(page.range).toEqual([[20, 39]]);
    expect(page.in).toEqual([]);

    // One global count per display group, each narrowed to its raw review states.
    expect(calls.slice(1).map((call) => call.in[0]?.[1])).toEqual([
      ["awaiting_assessment", "human_review"],
      ["changes_requested"],
      ["approved"],
      ["rejected"]
    ]);

    expect(result).toEqual({
      ok: true,
      value: {
        items: [
          {
            applicationId: QUEUE_ROW.application_id,
            name: "Panadería Sol",
            sector: "Alimentos",
            state: "human_review",
            updatedAt: QUEUE_ROW.updated_at
          }
        ],
        total: 1,
        counts: COUNTS
      }
    });
  });

  it("narrows the page and the total server-side to the selected display state", async () => {
    const { client, calls } = fakeQueueClient({ data: [QUEUE_ROW], count: 1 }, { counts: COUNTS });

    await new SupabaseSmeRequestRepository(client).listAdminQueue({
      page: 1,
      pageSize: 20,
      sort: "updatedAt",
      order: "desc",
      state: "pending"
    });

    expect(calls[0]!.in).toEqual([["state", ["awaiting_assessment", "human_review"]]]);
  });

  it("searches server-side over name, application id and sector", async () => {
    const { client, calls } = fakeQueueClient({ data: [], count: 0 }, { counts: COUNTS });

    await new SupabaseSmeRequestRepository(client).listAdminQueue({
      page: 1,
      pageSize: 20,
      sort: "updatedAt",
      order: "desc",
      search: "sol"
    });

    expect(calls[0]!.or).toEqual(["name.ilike.*sol*,application_id.ilike.*sol*,sector.ilike.*sol*"]);
  });

  it("renders a missing business as 'Sin dato', never an invented name", async () => {
    const { client } = fakeQueueClient({ data: [{ ...QUEUE_ROW, name: null, sector: null }], count: 1 }, { counts: COUNTS });

    const result = await new SupabaseSmeRequestRepository(client).listAdminQueue({
      page: 1,
      pageSize: 20,
      sort: "updatedAt",
      order: "desc"
    });

    expect(result).toEqual({
      ok: true,
      value: {
        items: [
          {
            applicationId: QUEUE_ROW.application_id,
            name: "Sin dato",
            sector: "Sin dato",
            state: "human_review",
            updatedAt: QUEUE_ROW.updated_at
          }
        ],
        total: 1,
        counts: COUNTS
      }
    });
  });

  it("is unavailable on a Postgres error, a missing count or a malformed row without leaking text", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [
      { error: pgError("42501") },
      { data: [QUEUE_ROW] },
      { data: [{ ...QUEUE_ROW, state: "not_a_state" }], count: 1 },
      { data: [{ ...QUEUE_ROW, updated_at: null }], count: 1 },
      { reject: new Error("network SECRET") }
    ] as const) {
      const { client } = fakeQueueClient(step, { counts: COUNTS });
      const result = await new SupabaseSmeRequestRepository(client).listAdminQueue({
        page: 1,
        pageSize: 20,
        sort: "updatedAt",
        order: "desc"
      });
      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
      expect(JSON.stringify(result)).not.toContain("SECRET");
    }
  });

  it("is unavailable when a global count query fails, without leaking provider text", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const countStep of [{ error: pgError("42501") }, { reject: new Error("network SECRET") }] as const) {
      const { client } = fakeQueueClient({ data: [QUEUE_ROW], count: 1 }, countStep);
      const result = await new SupabaseSmeRequestRepository(client).listAdminQueue({
        page: 1,
        pageSize: 20,
        sort: "updatedAt",
        order: "desc"
      });
      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
      expect(JSON.stringify(result)).not.toContain("SECRET");
    }
  });
});

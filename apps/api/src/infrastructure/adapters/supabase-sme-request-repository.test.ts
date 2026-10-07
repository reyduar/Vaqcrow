import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import type { SmeRequest } from "@vaqcrow/contracts";
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
  from: string[];
} {
  const rpc: Array<readonly [string, unknown]> = [];
  const eq: Array<readonly [string, unknown]> = [];
  const from: string[] = [];
  const result = () =>
    step.reject ? Promise.reject(step.reject) : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      eq.push([column, value]);
      return builder;
    },
    maybeSingle: () => result()
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

interface QueueStep {
  readonly data?: unknown;
  readonly count?: number | null;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

function fakeQueueClient(step: QueueStep): {
  client: SupabaseClient;
  from: string[];
  select: Array<readonly [string, unknown]>;
  order: Array<readonly [string, unknown]>;
  or: string[];
  range: Array<readonly [number, number]>;
} {
  const from: string[] = [];
  const select: Array<readonly [string, unknown]> = [];
  const order: Array<readonly [string, unknown]> = [];
  const or: string[] = [];
  const range: Array<readonly [number, number]> = [];
  const result = () =>
    step.reject
      ? Promise.reject(step.reject)
      : Promise.resolve({ data: step.data ?? null, error: step.error ?? null, count: step.count ?? null });
  const builder = {
    select: (columns: string, options?: unknown) => {
      select.push([columns, options]);
      return builder;
    },
    order: (column: string, options?: unknown) => {
      order.push([column, options]);
      return builder;
    },
    or: (filter: string) => {
      or.push(filter);
      return builder;
    },
    range: (first: number, last: number) => {
      range.push([first, last]);
      return result();
    }
  };
  return {
    client: {
      from: (table: string) => {
        from.push(table);
        return builder;
      }
    } as unknown as SupabaseClient,
    from,
    select,
    order,
    or,
    range
  };
}

describe("SupabaseSmeRequestRepository.listAdminQueue", () => {
  const QUEUE_ROW = {
    application_id: "11111111-1111-4111-8111-111111111111",
    name: "Panadería Sol",
    sector: "Alimentos",
    state: "human_review",
    updated_at: "2026-10-04T12:00:00.000Z"
  };

  it("reads the joined view with server-side order/range and maps the page", async () => {
    const { client, from, select, order, range } = fakeQueueClient({ data: [QUEUE_ROW], count: 1 });

    const result = await new SupabaseSmeRequestRepository(client).listAdminQueue({
      page: 2,
      pageSize: 20,
      sort: "name",
      order: "asc"
    });

    expect(from).toEqual(["admin_sme_request_queue"]);
    expect(select).toEqual([["*", { count: "exact" }]]);
    expect(order).toEqual([["name", { ascending: true }]]);
    expect(range).toEqual([[20, 39]]);
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
        total: 1
      }
    });
  });

  it("searches server-side over name, application id and sector", async () => {
    const { client, or } = fakeQueueClient({ data: [], count: 0 });

    await new SupabaseSmeRequestRepository(client).listAdminQueue({
      page: 1,
      pageSize: 20,
      sort: "updatedAt",
      order: "desc",
      search: "sol"
    });

    expect(or).toEqual(["name.ilike.*sol*,application_id.ilike.*sol*,sector.ilike.*sol*"]);
  });

  it("renders a missing business as 'Sin dato', never an invented name", async () => {
    const { client } = fakeQueueClient({ data: [{ ...QUEUE_ROW, name: null, sector: null }], count: 1 });

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
        total: 1
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
      const { client } = fakeQueueClient(step);
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

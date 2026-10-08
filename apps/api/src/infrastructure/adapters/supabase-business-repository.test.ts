import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BusinessDraft } from "../../application/ports/business-repository-port.js";
import { SupabaseBusinessRepository } from "./supabase-business-repository.js";

const OWNER = "00000000-0000-4000-8000-000000000004";
const BUSINESS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const DRAFT: BusinessDraft = {
  name: "Panadería Sol",
  cuit: "20123456789",
  sector: "Alimentos",
  city: "CABA",
  description: "Panadería artesanal de barrio",
  goalArs: 5_000_000,
  revenueShare: 5
};

const ROW = {
  id: BUSINESS_ID,
  owner_user_id: OWNER,
  name: "Panadería Sol",
  cuit: "20123456789",
  sector: "Alimentos",
  city: "CABA",
  description: "Panadería artesanal de barrio",
  goal_ars: 5_000_000,
  revenue_share: 5,
  created_at: "2026-10-03T12:00:00.000Z",
  updated_at: "2026-10-03T12:00:00.000Z"
};

const EXPECTED = {
  businessId: BUSINESS_ID,
  ownerUserId: OWNER,
  ...DRAFT,
  createdAt: ROW.created_at,
  updatedAt: ROW.updated_at
};

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

function fakeClient(step: FakeStep) {
  const calls = {
    from: [] as string[],
    insert: [] as unknown[],
    eq: [] as Array<readonly [string, unknown]>,
    single: 0,
    maybeSingle: 0
  };
  const result = () =>
    step.reject
      ? Promise.reject(step.reject)
      : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });

  const builder = {
    insert: (payload: unknown) => {
      calls.insert.push(payload);
      return builder;
    },
    select: () => builder,
    eq: (column: string, value: unknown) => {
      calls.eq.push([column, value]);
      return builder;
    },
    single: () => {
      calls.single += 1;
      return result();
    },
    maybeSingle: () => {
      calls.maybeSingle += 1;
      return result();
    }
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

describe("SupabaseBusinessRepository.createForOwner", () => {
  it("inserts the company under the principal's owner id and maps the stored row", async () => {
    const { client, calls } = fakeClient({ data: ROW });

    const result = await new SupabaseBusinessRepository(client).createForOwner({
      ownerUserId: OWNER,
      draft: DRAFT
    });

    expect(calls.from).toEqual(["businesses"]);
    expect(calls.insert).toEqual([
      {
        owner_user_id: OWNER,
        name: "Panadería Sol",
        cuit: "20123456789",
        sector: "Alimentos",
        city: "CABA",
        description: "Panadería artesanal de barrio",
        goal_ars: 5_000_000,
        revenue_share: 5
      }
    ]);
    expect(calls.single).toBe(1);
    expect(result).toEqual({ ok: true, value: EXPECTED });
  });

  it("persists and reads the deadline when the draft carries one", async () => {
    const deadline = "2026-12-01T00:00:00.000Z";
    const { client, calls } = fakeClient({ data: { ...ROW, deadline } });

    const result = await new SupabaseBusinessRepository(client).createForOwner({
      ownerUserId: OWNER,
      draft: { ...DRAFT, deadline }
    });

    expect(calls.insert).toEqual([
      {
        owner_user_id: OWNER,
        name: "Panadería Sol",
        cuit: "20123456789",
        sector: "Alimentos",
        city: "CABA",
        description: "Panadería artesanal de barrio",
        goal_ars: 5_000_000,
        revenue_share: 5,
        deadline
      }
    ]);
    expect(result).toEqual({ ok: true, value: { ...EXPECTED, deadline } });
  });

  it("omits the deadline column when the draft carries none", async () => {
    const { client, calls } = fakeClient({ data: ROW });

    const result = await new SupabaseBusinessRepository(client).createForOwner({
      ownerUserId: OWNER,
      draft: { ...DRAFT, deadline: null }
    });

    expect(calls.insert).toEqual([
      {
        owner_user_id: OWNER,
        name: "Panadería Sol",
        cuit: "20123456789",
        sector: "Alimentos",
        city: "CABA",
        description: "Panadería artesanal de barrio",
        goal_ars: 5_000_000,
        revenue_share: 5
      }
    ]);
    expect(result).toEqual({ ok: true, value: EXPECTED });
  });

  it("persists and reads the campaign duration when the draft carries one (#410/U13)", async () => {
    const { client, calls } = fakeClient({ data: { ...ROW, campaign_duration_days: 60 } });

    const result = await new SupabaseBusinessRepository(client).createForOwner({
      ownerUserId: OWNER,
      draft: { ...DRAFT, campaignDurationDays: 60 }
    });

    expect(calls.insert).toEqual([
      {
        owner_user_id: OWNER,
        name: "Panadería Sol",
        cuit: "20123456789",
        sector: "Alimentos",
        city: "CABA",
        description: "Panadería artesanal de barrio",
        goal_ars: 5_000_000,
        revenue_share: 5,
        campaign_duration_days: 60
      }
    ]);
    expect(result).toEqual({ ok: true, value: { ...EXPECTED, campaignDurationDays: 60 } });
  });

  it("maps a check violation to invalid_request without leaking Postgres text", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ error: pgError("23514") });

    const result = await new SupabaseBusinessRepository(client).createForOwner({
      ownerUserId: OWNER,
      draft: DRAFT
    });

    expect(result).toEqual({ ok: false, error: { code: "invalid_request" } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(consoleError).toHaveBeenCalled();
  });

  it("is unavailable for any other error, a null payload, or a malformed stored row", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [
      { error: pgError("42501") },
      { data: null },
      { data: { ...ROW, id: 42 } },
      { data: { ...ROW, goal_ars: "abc" } },
      { reject: new Error("network SECRET") }
    ] as const) {
      const { client } = fakeClient(step);
      const result = await new SupabaseBusinessRepository(client).createForOwner({
        ownerUserId: OWNER,
        draft: DRAFT
      });
      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    }
  });
});

describe("SupabaseBusinessRepository.findByOwner", () => {
  it("scopes the read by owner_user_id", async () => {
    const { client, calls } = fakeClient({ data: ROW });

    const result = await new SupabaseBusinessRepository(client).findByOwner(OWNER);

    expect(calls.eq).toEqual([["owner_user_id", OWNER]]);
    expect(calls.maybeSingle).toBe(1);
    expect(result).toEqual({ ok: true, value: EXPECTED });
  });

  it("reads a stored deadline back into the record", async () => {
    const deadline = "2026-12-01T00:00:00.000Z";
    const { client } = fakeClient({ data: { ...ROW, deadline } });

    const result = await new SupabaseBusinessRepository(client).findByOwner(OWNER);

    expect(result).toEqual({ ok: true, value: { ...EXPECTED, deadline } });
  });

  it("is unavailable when the stored deadline is not a string", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ data: { ...ROW, deadline: 42 } });

    expect(await new SupabaseBusinessRepository(client).findByOwner(OWNER)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("reads a stored campaign duration back into the record (#410/U13)", async () => {
    const { client } = fakeClient({ data: { ...ROW, campaign_duration_days: 90 } });

    const result = await new SupabaseBusinessRepository(client).findByOwner(OWNER);

    expect(result).toEqual({ ok: true, value: { ...EXPECTED, campaignDurationDays: 90 } });
  });

  it("omits the campaign duration when the stored value is NULL", async () => {
    const { client } = fakeClient({ data: { ...ROW, campaign_duration_days: null } });

    expect(await new SupabaseBusinessRepository(client).findByOwner(OWNER)).toEqual({ ok: true, value: EXPECTED });
  });

  it.each([45, "60", 30.5])("is unavailable when the stored campaign duration is %s", async (stored) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ data: { ...ROW, campaign_duration_days: stored } });

    expect(await new SupabaseBusinessRepository(client).findByOwner(OWNER)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("is not_found when the owner has no company", async () => {
    const { client } = fakeClient({ data: null });

    expect(await new SupabaseBusinessRepository(client).findByOwner(OWNER)).toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("is unavailable on a Postgres error or a malformed stored row", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [{ error: pgError("XX000") }, { data: { ...ROW, created_at: null } }] as const) {
      const { client } = fakeClient(step);
      expect(await new SupabaseBusinessRepository(client).findByOwner(OWNER)).toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
    }
  });
});

describe("SupabaseBusinessRepository.findOwnedById", () => {
  it("scopes the read by business id and owner", async () => {
    const { client, calls } = fakeClient({ data: ROW });

    const result = await new SupabaseBusinessRepository(client).findOwnedById({
      ownerUserId: OWNER,
      businessId: BUSINESS_ID
    });

    expect(calls.eq).toEqual([
      ["id", BUSINESS_ID],
      ["owner_user_id", OWNER]
    ]);
    expect(result).toEqual({ ok: true, value: EXPECTED });
  });

  it("is not_found without querying when the id cannot be a primary key", async () => {
    const { client, calls } = fakeClient({ data: ROW });

    const result = await new SupabaseBusinessRepository(client).findOwnedById({
      ownerUserId: OWNER,
      businessId: "panaderia-horizonte"
    });

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(calls.from).toEqual([]);
  });

  it("is not_found when the id is not owned by the caller", async () => {
    const { client } = fakeClient({ data: null });

    expect(
      await new SupabaseBusinessRepository(client).findOwnedById({ ownerUserId: OWNER, businessId: BUSINESS_ID })
    ).toEqual({ ok: false, error: { code: "not_found" } });
  });
});

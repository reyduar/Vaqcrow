import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseAdminUsersReader } from "./supabase-admin-users-reader.js";

/**
 * The ADMIN users read adapter (#390, WU2). It composes `profile`, the Supabase
 * Auth user list and the simulated `investor_kyc`, applies the search/filters
 * and the page slice, and maps the KYC label by role. A provider error, an
 * inconsistent account or a malformed column is `unavailable`; the provider's
 * message/details/hint never reach the caller.
 */
const ADMIN_ID = "00000000-0000-4000-8000-000000000005";
const INVESTOR_ID = "11111111-1111-4111-8111-111111111111";
const INVESTOR_NO_KYC = "22222222-2222-4222-8222-222222222222";
const PYME_ID = "33333333-3333-4333-8333-333333333333";

const ADMIN_ROW = { user_id: ADMIN_ID, role: "ADMIN", display_name: "Admin Vaqcrow", status: "active", chat_enabled: false };
const INVESTOR_ROW = { user_id: INVESTOR_ID, role: "INVERSOR", display_name: "Ana", status: "active", chat_enabled: true };
const INVESTOR_NO_KYC_ROW = { user_id: INVESTOR_NO_KYC, role: "INVERSOR", display_name: "Beto", status: "inactive", chat_enabled: false };
const PYME_ROW = { user_id: PYME_ID, role: "PYME", display_name: "Panadería", status: "inactive", chat_enabled: true };

const AUTH_USERS = [
  { id: ADMIN_ID, email: "admin@vaqcrow.com", last_sign_in_at: "2026-10-12T13:00:00.000Z", email_confirmed_at: "2026-01-01T00:00:00.000Z" },
  { id: INVESTOR_ID, email: "ana@vaqcrow.com" },
  { id: INVESTOR_NO_KYC, email: "beto@vaqcrow.com", last_sign_in_at: "2026-09-01T00:00:00.000Z" },
  { id: PYME_ID, email: "pan@vaqcrow.com", invited_at: "2026-10-10T00:00:00.000Z", email_confirmed_at: null }
];

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

interface FakeAuth {
  readonly users?: readonly unknown[];
  readonly error?: FakeStep["error"];
  readonly reject?: Error;
}

function fakeClient(perTable: Record<string, FakeStep>, auth: FakeAuth = {}): SupabaseClient {
  const client = {
    from: (table: string) => {
      const step = perTable[table] ?? { data: [] };
      const builder = {
        select: () => builder,
        then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
          const settled = step.reject
            ? Promise.reject(step.reject)
            : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });
          return settled.then(onFulfilled, onRejected);
        }
      };
      return builder;
    },
    auth: {
      admin: {
        listUsers: async () => {
          if (auth.reject) throw auth.reject;
          if (auth.error) return { data: { users: [] }, error: auth.error };
          return { data: { users: auth.users ?? [] }, error: null };
        }
      }
    }
  } as unknown as SupabaseClient;
  return client;
}

function fullTables(overrides: Record<string, FakeStep> = {}): Record<string, FakeStep> {
  return {
    profile: { data: [ADMIN_ROW, INVESTOR_ROW, INVESTOR_NO_KYC_ROW, PYME_ROW] },
    investor_kyc: { data: [{ user_id: INVESTOR_ID }] },
    ...overrides
  };
}

describe("SupabaseAdminUsersReader", () => {
  it("composes profile, Auth and KYC into a page, marking the viewer's own row", async () => {
    const client = fakeClient(fullTables(), { users: AUTH_USERS });

    const result = await new SupabaseAdminUsersReader(client).list({ page: 1, pageSize: 20 }, ADMIN_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ total: 4, page: 1, pageSize: 20 });
    // Deterministic order: display name, case-insensitive.
    expect(result.value.items.map((item) => item.displayName)).toEqual([
      "Admin Vaqcrow",
      "Ana",
      "Beto",
      "Panadería"
    ]);
    expect(result.value.items[0]).toEqual({
      userId: ADMIN_ID,
      displayName: "Admin Vaqcrow",
      email: "admin@vaqcrow.com",
      role: "ADMIN",
      status: "active",
      lastActivityAt: "2026-10-12T13:00:00.000Z",
      kycStatus: "not_applicable",
      isSelf: true,
      chatEnabled: false
    });
  });

  it("projects the per-user assistant flag (#499, D9) from profile.chat_enabled", async () => {
    const client = fakeClient(fullTables(), { users: AUTH_USERS });

    const result = await new SupabaseAdminUsersReader(client).list({ page: 1, pageSize: 20 }, ADMIN_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = new Map(result.value.items.map((item) => [item.userId, item.chatEnabled]));
    expect(byId.get(ADMIN_ID)).toBe(false);
    expect(byId.get(INVESTOR_ID)).toBe(true);
    expect(byId.get(PYME_ID)).toBe(true);
  });

  it("maps kycStatus by role: approved_simulated, not_started, not_applicable", async () => {
    const client = fakeClient(fullTables(), { users: AUTH_USERS });

    const result = await new SupabaseAdminUsersReader(client).list({ page: 1, pageSize: 20 }, ADMIN_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = new Map(result.value.items.map((item) => [item.userId, item.kycStatus]));
    expect(byId.get(INVESTOR_ID)).toBe("approved_simulated");
    expect(byId.get(INVESTOR_NO_KYC)).toBe("not_started");
    expect(byId.get(PYME_ID)).toBe("not_applicable");
    expect(byId.get(ADMIN_ID)).toBe("not_applicable");
  });

  it("marks an invited, unconfirmed account as invited and a never-signed-in one as null activity", async () => {
    const client = fakeClient(fullTables(), { users: AUTH_USERS });

    const result = await new SupabaseAdminUsersReader(client).list({ page: 1, pageSize: 20 }, ADMIN_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = new Map(result.value.items.map((item) => [item.userId, item]));
    expect(byId.get(PYME_ID)?.status).toBe("invited");
    expect(byId.get(INVESTOR_ID)?.lastActivityAt).toBeNull();
    expect(byId.get(INVESTOR_NO_KYC)?.status).toBe("inactive");
  });

  it("filters by search (case-insensitive over name/email), role and status", async () => {
    const client = fakeClient(fullTables(), { users: AUTH_USERS });
    const reader = new SupabaseAdminUsersReader(client);

    const bySearch = await reader.list({ search: "BETO", page: 1, pageSize: 20 }, ADMIN_ID);
    expect(bySearch.ok && bySearch.value.items.map((item) => item.userId)).toEqual([INVESTOR_NO_KYC]);

    const byEmail = await reader.list({ search: "pan@vaqcrow.com", page: 1, pageSize: 20 }, ADMIN_ID);
    expect(byEmail.ok && byEmail.value.items.map((item) => item.userId)).toEqual([PYME_ID]);

    const byRole = await reader.list({ role: "INVERSOR", page: 1, pageSize: 20 }, ADMIN_ID);
    expect(byRole.ok && byRole.value.items.map((item) => item.userId)).toEqual([INVESTOR_ID, INVESTOR_NO_KYC]);

    const byStatus = await reader.list({ status: "invited", page: 1, pageSize: 20 }, ADMIN_ID);
    expect(byStatus.ok && byStatus.value.items.map((item) => item.userId)).toEqual([PYME_ID]);
  });

  it("paginates the filtered set and reports the full total", async () => {
    const client = fakeClient(fullTables(), { users: AUTH_USERS });

    const page2 = await new SupabaseAdminUsersReader(client).list({ page: 2, pageSize: 2 }, ADMIN_ID);

    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(page2.value).toMatchObject({ total: 4, page: 2, pageSize: 2 });
    expect(page2.value.items.map((item) => item.userId)).toEqual([INVESTOR_NO_KYC, PYME_ID]);
  });

  it("reports unavailable on a provider error, never leaking its text", async () => {
    const client = fakeClient(
      fullTables({ profile: { error: { code: "PGRST500", message: "secret detail", details: "d", hint: "h" } } }),
      { users: AUTH_USERS }
    );

    const result = await new SupabaseAdminUsersReader(client).list({ page: 1, pageSize: 20 }, ADMIN_ID);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("secret detail");
  });

  it("reports unavailable on an auth read failure or a malformed column", async () => {
    const authFails = fakeClient(fullTables(), {
      error: { code: "unexpected_failure", message: "secret detail", details: "d", hint: "h" }
    });
    const badRole = fakeClient(
      fullTables({ profile: { data: [{ ...ADMIN_ROW, role: "SUPERADMIN" }] } }),
      { users: AUTH_USERS }
    );
    const notAnArray = fakeClient(fullTables({ profile: { data: { not: "an array" } } }), { users: AUTH_USERS });
    const badFlag = fakeClient(
      fullTables({ profile: { data: [{ ...ADMIN_ROW, chat_enabled: "yes" }] } }),
      { users: AUTH_USERS }
    );

    expect(await new SupabaseAdminUsersReader(authFails).list({ page: 1, pageSize: 20 }, ADMIN_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    expect(await new SupabaseAdminUsersReader(badRole).list({ page: 1, pageSize: 20 }, ADMIN_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    expect(await new SupabaseAdminUsersReader(notAnArray).list({ page: 1, pageSize: 20 }, ADMIN_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    expect(await new SupabaseAdminUsersReader(badFlag).list({ page: 1, pageSize: 20 }, ADMIN_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("reports unavailable for a profile with no auth user or an auth user with no email", async () => {
    const orphanProfile = fakeClient(
      fullTables({ profile: { data: [{ ...ADMIN_ROW, user_id: "99999999-9999-4999-8999-999999999999" }] } }),
      { users: AUTH_USERS }
    );
    const noEmail = fakeClient(fullTables({ profile: { data: [ADMIN_ROW] } }), {
      users: [{ id: ADMIN_ID }]
    });

    expect(await new SupabaseAdminUsersReader(orphanProfile).list({ page: 1, pageSize: 20 }, ADMIN_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    expect(await new SupabaseAdminUsersReader(noEmail).list({ page: 1, pageSize: 20 }, ADMIN_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

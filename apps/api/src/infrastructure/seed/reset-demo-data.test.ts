import { describe, expect, it, vi } from "vitest";
import {
  parseResetEnv,
  resetDemoData,
  RESET_CONFIRM_VARIABLE,
  RESET_CONFIRM_VALUE,
  RESET_ENV_NAMES,
  RESET_TABLES,
  runResetDemoData,
  type ResetClient
} from "./reset-demo-data.js";

/**
 * The demo-data reset (destructive). These tests use a fake client that records
 * the calls, so they assert the guards (a run without the confirmation, or whose
 * super admin does not resolve to an active ADMIN, deletes nothing), the
 * child-first table order, that the admin is never deleted, and the counts.
 */
const ADMIN_ID = "05d6a96b-b5f7-4630-bb94-f046ac9cab50";
const ADMIN_EMAIL = "reyaduarte@gmail.com";
const OTHER_USERS = [
  { id: "11111111-1111-4111-8111-111111111111", email: "pyme.reh.x@example.test" },
  { id: "22222222-2222-4222-8222-222222222222", email: "inversor.reh.x@example.test" }
];

interface Recorded {
  readonly order: string[];
  readonly tables: string[];
  readonly profileDeleteFilters: string[];
  readonly deletedUsers: string[];
  readonly storageRemoved: string[][];
}

function fakeClient(options: { readonly adminRole?: string; readonly adminStatus?: string } = {}): {
  client: ResetClient;
  recorded: Recorded;
} {
  const recorded: Recorded = { order: [], tables: [], profileDeleteFilters: [], deletedUsers: [], storageRemoved: [] };

  const client: ResetClient = {
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({
          data: { users: [{ id: ADMIN_ID, email: ADMIN_EMAIL }, ...OTHER_USERS] },
          error: null
        })),
        deleteUser: vi.fn(async (id: string) => {
          recorded.order.push(`user:${id}`);
          recorded.deletedUsers.push(id);
          return { error: null };
        })
      }
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { role: options.adminRole ?? "ADMIN", status: options.adminStatus ?? "active" },
            error: null
          })
        })
      }),
      delete: () => ({
        not: async (column: string) => {
          recorded.order.push(`${table}:not(${column})`);
          recorded.tables.push(`${table}:not(${column})`);
          return { error: null };
        },
        neq: async (column: string, value: string) => {
          recorded.order.push(`${table}:neq(${column})`);
          recorded.profileDeleteFilters.push(`${table}:${column}!=${value}`);
          return { error: null };
        }
      })
    }),
    storage: {
      from: () => ({
        list: vi.fn(async (prefix: string) => {
          if (prefix === "") {
            return { data: [{ name: "owner-a", id: null, metadata: null }], error: null };
          }
          if (prefix === "owner-a") {
            return { data: [{ name: "cuit", id: null, metadata: null }], error: null };
          }
          return {
            data: [{ name: "doc.pdf", id: "abc", metadata: { size: 1 } }],
            error: null
          };
        }),
        remove: async (paths: string[]) => {
          recorded.order.push("storage:remove");
          recorded.storageRemoved.push(paths);
          return { error: null };
        }
      })
    }
  };

  return { client, recorded };
}

describe("resetDemoData", () => {
  it("clears the activity tables child-first, deletes every non-admin account and the storage objects", async () => {
    const { client, recorded } = fakeClient();

    const outcome = await resetDemoData({ client, superAdminEmail: ADMIN_EMAIL });

    expect(outcome).toEqual({ status: "done", tablesCleared: RESET_TABLES.length, usersDeleted: 2, objectsDeleted: 1 });
    expect(recorded.tables).toEqual(RESET_TABLES.map((entry) => `${entry.table}:not(${entry.filter})`));
    // Children (campaign_contribution) before parents (campaign); verdicts before documents.
    expect(recorded.tables.indexOf("campaign_contribution:not(campaign_id)")).toBeLessThan(
      recorded.tables.indexOf("campaign:not(campaign_id)")
    );
    expect(recorded.tables.indexOf("document_verdict:not(application_id)")).toBeLessThan(
      recorded.tables.indexOf("pyme_document:not(id)")
    );
    // audit_log (NO ACTION -> profile) is cleared before the profile rows.
    expect(recorded.order.indexOf("audit_log:not(id)")).toBeLessThan(recorded.order.indexOf("profile:neq(user_id)"));
    expect(recorded.profileDeleteFilters).toEqual([`profile:user_id!=${ADMIN_ID}`]);
    expect(recorded.deletedUsers).toEqual(OTHER_USERS.map((user) => user.id));
    expect(recorded.storageRemoved).toEqual([["owner-a/cuit/doc.pdf"]]);
  });

  it("never deletes the admin", async () => {
    const { client, recorded } = fakeClient();

    await resetDemoData({ client, superAdminEmail: ADMIN_EMAIL });

    expect(recorded.deletedUsers).not.toContain(ADMIN_ID);
  });

  it("refuses without deleting anything when the super admin email does not resolve", async () => {
    const { client, recorded } = fakeClient();

    const outcome = await resetDemoData({ client, superAdminEmail: "nobody@example.test" });

    expect(outcome).toMatchObject({ status: "refused" });
    expect(recorded.tables).toEqual([]);
    expect(recorded.deletedUsers).toEqual([]);
  });

  it("refuses when the resolved account is not an active ADMIN", async () => {
    const { client, recorded } = fakeClient({ adminRole: "PYME" });

    const outcome = await resetDemoData({ client, superAdminEmail: ADMIN_EMAIL });

    expect(outcome).toMatchObject({ status: "refused" });
    expect(recorded.tables).toEqual([]);
    expect(recorded.deletedUsers).toEqual([]);
  });
});

describe("parseResetEnv", () => {
  it("names the missing variables, never their values", () => {
    const result = parseResetEnv({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual([...RESET_ENV_NAMES]);
    }
  });

  it("accepts a complete environment", () => {
    const result = parseResetEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
      VAQCROW_SUPERADMIN_EMAIL: ADMIN_EMAIL
    });
    expect(result.ok).toBe(true);
  });
});

describe("runResetDemoData", () => {
  const baseEnv = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "secret",
    VAQCROW_SUPERADMIN_EMAIL: ADMIN_EMAIL
  };

  it("refuses without the explicit confirmation, before touching the client", async () => {
    const createClient = vi.fn();
    const print = vi.fn();

    const code = await runResetDemoData({ env: baseEnv, createClient, print });

    expect(code).toBe(1);
    expect(createClient).not.toHaveBeenCalled();
    expect(print.mock.calls[0]?.[0]).toContain(RESET_CONFIRM_VARIABLE);
    expect(String(print.mock.calls[0]?.[0])).toContain(RESET_CONFIRM_VALUE);
  });

  it("refuses when a required variable is missing (by name, not value)", async () => {
    const print = vi.fn();

    const code = await runResetDemoData({
      env: { [RESET_CONFIRM_VARIABLE]: RESET_CONFIRM_VALUE, SUPABASE_URL: "https://example.supabase.co" },
      createClient: vi.fn(),
      print
    });

    expect(code).toBe(1);
    expect(String(print.mock.calls[0]?.[0])).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("reports the outcome and exits 0 on success", async () => {
    const { client } = fakeClient();
    const print = vi.fn();

    const code = await runResetDemoData({
      env: { ...baseEnv, [RESET_CONFIRM_VARIABLE]: RESET_CONFIRM_VALUE },
      createClient: () => client,
      print
    });

    expect(code).toBe(0);
    expect(String(print.mock.calls[0]?.[0])).toContain("Demo data reset");
  });
});

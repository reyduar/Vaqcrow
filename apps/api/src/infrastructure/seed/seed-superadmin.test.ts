import { describe, expect, it, vi } from "vitest";
import {
  SUPERADMIN_DISPLAY_NAME,
  SUPERADMIN_USERNAME,
  parseSeedEnv,
  runSeedSuperAdmin,
  seedSuperAdmin
} from "./seed-superadmin.js";
import type { SeedClient } from "./seed-superadmin.js";

const EMAIL = "admin@vaqcrow.example";
const PASSWORD = "S3cret-Passw0rd-do-not-print";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

interface Fake {
  readonly createError?: { code?: string; status?: number; message?: string } | null;
  readonly existing?: Array<{ id: string; email?: string }>;
  readonly profile?: { user_id: string; role: string; status: string } | null;
  readonly profileError?: { code: string } | null;
}

function fakeClient(fake: Fake) {
  const created: unknown[] = [];
  const reads: Array<readonly [string, unknown]> = [];
  const client: SeedClient = {
    auth: {
      admin: {
        createUser: async (attributes) => {
          created.push(attributes);
          return fake.createError
            ? { data: { user: null }, error: fake.createError }
            : { data: { user: { id: USER_ID } }, error: null };
        },
        listUsers: async () => ({ data: { users: fake.existing ?? [] }, error: null })
      }
    },
    from: () => ({
      select: () => ({
        eq: (column: string, value: unknown) => {
          reads.push([column, value]);
          return {
            maybeSingle: async () => ({ data: fake.profile ?? null, error: fake.profileError ?? null })
          };
        }
      })
    })
  };
  return { client, created, reads };
}

describe("seedSuperAdmin", () => {
  it("creates a confirmed ADMIN user whose app_metadata drives the profile trigger", async () => {
    const { client, created, reads } = fakeClient({ profile: { user_id: USER_ID, role: "ADMIN", status: "active" } });

    const outcome = await seedSuperAdmin({ client, email: EMAIL, password: PASSWORD });

    expect(outcome).toEqual({ status: "created", userId: USER_ID });
    expect(reads).toEqual([["user_id", USER_ID]]);
    expect(created).toEqual([
      {
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        // INVERSOR passes the strict insert trigger; the app_metadata update promotes to ADMIN.
        user_metadata: { role: "INVERSOR", display_name: "Admin Vaqcrow" },
        app_metadata: { role: "ADMIN", display_name: "Admin Vaqcrow", username: "vaqcrow.admin" }
      }
    ]);
    expect(SUPERADMIN_DISPLAY_NAME).toBe("Admin Vaqcrow");
    expect(SUPERADMIN_USERNAME).toBe("vaqcrow.admin");
  });

  it.each([
    ["the profile was not promoted", { user_id: USER_ID, role: "INVERSOR", status: "active" }],
    ["the profile is missing", null]
  ])("reports a failure when, after creation, %s", async (_label, profile) => {
    const { client } = fakeClient({ profile });

    const outcome = await seedSuperAdmin({ client, email: EMAIL, password: PASSWORD });

    expect(outcome.status).toBe("failed");
    expect(JSON.stringify(outcome)).toContain("not an active ADMIN");
  });

  it("fails when the post-creation profile read errors", async () => {
    const { client } = fakeClient({ profileError: { code: "57014" } });
    const outcome = await seedSuperAdmin({ client, email: EMAIL, password: PASSWORD });
    expect(outcome).toMatchObject({ status: "failed" });
    expect(JSON.stringify(outcome)).toContain("57014");
  });

  it("is a no-op when the user already exists with an active ADMIN profile", async () => {
    const { client, reads } = fakeClient({
      createError: { code: "email_exists", status: 422 },
      existing: [{ id: "other", email: "x@y.z" }, { id: USER_ID, email: EMAIL.toUpperCase() }],
      profile: { user_id: USER_ID, role: "ADMIN", status: "active" }
    });

    const outcome = await seedSuperAdmin({ client, email: EMAIL, password: PASSWORD });

    expect(outcome).toEqual({ status: "already_present", userId: USER_ID });
    expect(reads).toEqual([["user_id", USER_ID]]);
  });

  it.each([
    ["a PYME", { user_id: USER_ID, role: "PYME", status: "active" }],
    ["an inactive ADMIN", { user_id: USER_ID, role: "ADMIN", status: "inactive" }],
    ["a user without profile", null]
  ])("refuses, changing nothing, when the existing user is %s", async (_label, profile) => {
    const { client, created } = fakeClient({
      createError: { code: "email_exists", status: 422 },
      existing: [{ id: USER_ID, email: EMAIL }],
      profile
    });

    const outcome = await seedSuperAdmin({ client, email: EMAIL, password: PASSWORD });

    expect(outcome.status).toBe("refused");
    expect(created).toHaveLength(1); // only the failed create attempt; no update/promotion call exists
  });

  it("fails when the email is reported as existing but cannot be found", async () => {
    const { client } = fakeClient({ createError: { code: "email_exists", status: 422 }, existing: [] });
    expect((await seedSuperAdmin({ client, email: EMAIL, password: PASSWORD })).status).toBe("failed");
  });

  it("fails on any other create error without echoing the provider message or the password", async () => {
    const { client } = fakeClient({ createError: { code: "weak_password", status: 422, message: PASSWORD } });

    const outcome = await seedSuperAdmin({ client, email: EMAIL, password: PASSWORD });

    expect(outcome.status).toBe("failed");
    expect(JSON.stringify(outcome)).not.toContain(PASSWORD);
    expect(JSON.stringify(outcome)).toContain("weak_password");
    expect(JSON.stringify(outcome)).toContain("422");
  });

  it("fails when the profile read errors", async () => {
    const { client } = fakeClient({
      createError: { code: "email_exists", status: 422 },
      existing: [{ id: USER_ID, email: EMAIL }],
      profileError: { code: "57014" }
    });
    expect((await seedSuperAdmin({ client, email: EMAIL, password: PASSWORD })).status).toBe("failed");
  });
});

describe("provider error reporting", () => {
  it("surfaces the provider code and HTTP status, never the message", async () => {
    const { client } = fakeClient({
      createError: { code: "unexpected_failure", status: 500, message: "ERROR: signup role must be PYME" }
    });

    const outcome = await seedSuperAdmin({ client, email: EMAIL, password: PASSWORD });

    expect(outcome).toEqual({
      status: "failed",
      reason: "createUser failed: provider error code unexpected_failure (HTTP 500)"
    });
  });

  it("falls back to unknown when the provider gives neither code nor status", async () => {
    const { client } = fakeClient({ createError: {} });
    const outcome = await seedSuperAdmin({ client, email: EMAIL, password: PASSWORD });
    expect(outcome).toEqual({
      status: "failed",
      reason: "createUser failed: provider error code unknown (HTTP unknown)"
    });
  });
});

describe("parseSeedEnv", () => {
  const full = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    VAQCROW_SUPERADMIN_EMAIL: EMAIL,
    VAQCROW_SUPERADMIN_PASSWORD: PASSWORD
  };

  it("returns every value when all four variables are present", () => {
    expect(parseSeedEnv(full)).toEqual({
      ok: true,
      value: { supabaseUrl: full.SUPABASE_URL, serviceRoleKey: "service-key", email: EMAIL, password: PASSWORD }
    });
  });

  it.each(Object.keys(full))("names %s, and only the name, when it is missing", (name) => {
    const env: Record<string, string> = { ...full };
    delete env[name];
    const result = parseSeedEnv(env);
    expect(result).toEqual({ ok: false, missing: [name] });
  });

  it("treats a blank value as missing and reports every missing name at once", () => {
    const result = parseSeedEnv({ ...full, VAQCROW_SUPERADMIN_EMAIL: "  ", VAQCROW_SUPERADMIN_PASSWORD: "" });
    expect(result).toEqual({ ok: false, missing: ["VAQCROW_SUPERADMIN_EMAIL", "VAQCROW_SUPERADMIN_PASSWORD"] });
  });
});

describe("runSeedSuperAdmin", () => {
  const env = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-key-do-not-print",
    VAQCROW_SUPERADMIN_EMAIL: EMAIL,
    VAQCROW_SUPERADMIN_PASSWORD: PASSWORD
  };

  it("exits 1 naming the missing variable and never builds a client", async () => {
    const lines: string[] = [];
    const createClient = vi.fn();
    const { VAQCROW_SUPERADMIN_PASSWORD: _omit, ...rest } = env;
    void _omit;

    const code = await runSeedSuperAdmin({ env: rest, createClient, print: (line) => lines.push(line) });

    expect(code).toBe(1);
    expect(createClient).not.toHaveBeenCalled();
    expect(lines.join("\n")).toContain("VAQCROW_SUPERADMIN_PASSWORD");
  });

  it.each([
    ["created", { profile: { user_id: USER_ID, role: "ADMIN", status: "active" } }, 0, "created"],
    [
      "already present",
      {
        createError: { code: "email_exists", status: 422 },
        existing: [{ id: USER_ID, email: EMAIL }],
        profile: { user_id: USER_ID, role: "ADMIN", status: "active" }
      },
      0,
      "already present"
    ],
    [
      "refused",
      {
        createError: { code: "email_exists", status: 422 },
        existing: [{ id: USER_ID, email: EMAIL }],
        profile: { user_id: USER_ID, role: "PYME", status: "active" }
      },
      1,
      "not an active ADMIN"
    ]
  ] as Array<[string, Fake, number, string]>)("%s: exit code and output never contain a secret", async (_n, fake, code, text) => {
    const lines: string[] = [];
    const { client } = fakeClient(fake);

    const result = await runSeedSuperAdmin({ env, createClient: () => client, print: (line) => lines.push(line) });

    const output = lines.join("\n");
    expect(result).toBe(code);
    expect(output).toContain(text);
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain("service-key-do-not-print");
  });
});

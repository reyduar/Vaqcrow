/**
 * Manual, idempotent seed of the super admin (decision D3).
 *
 * Run per profile with `pnpm --filter @vaqcrow/api seed:superadmin:docker|cloud`;
 * it is never invoked at API startup, and the password it reads never leaves
 * the process: no output, error or log line carries it.
 *
 * The user is created through the Supabase Auth Admin API. GoTrue INSERTs the
 * auth user first (with `user_metadata` only, so the strict insert trigger needs
 * `user_metadata.role` = INVERSOR to accept it) and only then UPDATEs
 * `app_metadata`; the `on_auth_user_app_metadata_updated` trigger promotes the
 * profile to ADMIN when `app_metadata.role = "ADMIN"` (only the service role can
 * write `app_metadata`). The seed then reads the profile back and fails loudly if
 * it is not an active ADMIN. An existing user is never modified: it is a no-op when it is already an active
 * ADMIN and a loud refusal otherwise, so the script can never promote anyone.
 */

export const SUPERADMIN_DISPLAY_NAME = "Admin Vaqcrow";
export const SUPERADMIN_USERNAME = "vaqcrow.admin";

const EMAIL_EXISTS_CODE = "email_exists";
const LIST_PAGE_SIZE = 200;
const LIST_MAX_PAGES = 50;

interface ProviderError {
  readonly code?: string;
  readonly status?: number;
}

/** The slice of `SupabaseClient` the seed needs, so tests can inject a fake. */
export interface SeedClient {
  readonly auth: {
    readonly admin: {
      createUser(attributes: {
        email: string;
        password: string;
        email_confirm: boolean;
        user_metadata: Record<string, string>;
        app_metadata: Record<string, string>;
      }): Promise<{ data: { user: { id: string } | null }; error: ProviderError | null }>;
      listUsers(params: {
        page: number;
        perPage: number;
      }): Promise<{ data: { users: Array<{ id: string; email?: string }> }; error: ProviderError | null }>;
    };
  };
  from(table: "profile"): {
    select(columns: string): {
      eq(
        column: string,
        value: string
      ): {
        maybeSingle(): Promise<{
          data: { user_id: string; role: string; status: string } | null;
          error: { code?: string } | null;
        }>;
      };
    };
  };
}

export type SeedOutcome =
  | { readonly status: "created"; readonly userId: string }
  | { readonly status: "already_present"; readonly userId: string }
  | { readonly status: "refused"; readonly userId: string; readonly reason: string }
  | { readonly status: "failed"; readonly reason: string };

const failed = (reason: string): SeedOutcome => ({ status: "failed", reason });
/** Only the provider's code and HTTP status are reported: its message could echo input. */
const describe = (error: ProviderError): string =>
  `provider error code ${error.code ?? "unknown"} (HTTP ${error.status ?? "unknown"})`;
const describeDb = (error: { code?: string }): string => `database error code ${error.code ?? "unknown"}`;

const NOT_ADMIN_REASON = "a user with that email exists but is not an active ADMIN; nothing was changed";

async function readProfile(client: SeedClient, userId: string) {
  return client.from("profile").select("user_id, role, status").eq("user_id", userId).maybeSingle();
}

async function findUserIdByEmail(client: SeedClient, email: string): Promise<string | undefined | Error> {
  const wanted = email.toLowerCase();
  for (let page = 1; page <= LIST_MAX_PAGES; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: LIST_PAGE_SIZE });
    if (error) {
      return new Error(describe(error));
    }
    const match = data.users.find((user) => user.email?.toLowerCase() === wanted);
    if (match) {
      return match.id;
    }
    if (data.users.length < LIST_PAGE_SIZE) {
      return undefined;
    }
  }
  return undefined;
}

export async function seedSuperAdmin(input: {
  readonly client: SeedClient;
  readonly email: string;
  readonly password: string;
}): Promise<SeedOutcome> {
  const { client, email, password } = input;

  const created = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // INVERSOR only satisfies the strict insert trigger (user_metadata is
    // user-editable and can never grant ADMIN); app_metadata promotes to ADMIN.
    user_metadata: { role: "INVERSOR", display_name: SUPERADMIN_DISPLAY_NAME },
    app_metadata: { role: "ADMIN", display_name: SUPERADMIN_DISPLAY_NAME, username: SUPERADMIN_USERNAME }
  });

  if (!created.error && created.data.user) {
    const userId = created.data.user.id;
    const verified = await readProfile(client, userId);
    if (verified.error) {
      return failed(`created user ${userId} but the profile read failed: ${describeDb(verified.error)}`);
    }
    if (verified.data?.role !== "ADMIN" || verified.data.status !== "active") {
      return failed(`created user ${userId} but its profile is not an active ADMIN (the promotion did not apply)`);
    }
    return { status: "created", userId };
  }

  if (created.error?.code !== EMAIL_EXISTS_CODE) {
    return failed(created.error ? `createUser failed: ${describe(created.error)}` : "createUser returned no user");
  }

  const found = await findUserIdByEmail(client, email);
  if (found instanceof Error) {
    return failed(`listUsers failed: ${found.message}`);
  }
  if (found === undefined) {
    return failed("the email is reported as taken but no matching user was found");
  }

  const profile = await readProfile(client, found);
  if (profile.error) {
    return failed(`profile read failed: ${describeDb(profile.error)}`);
  }

  if (profile.data?.role === "ADMIN" && profile.data.status === "active") {
    return { status: "already_present", userId: found };
  }

  return {
    status: "refused",
    userId: found,
    reason: NOT_ADMIN_REASON
  };
}

export const SEED_ENV_NAMES = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VAQCROW_SUPERADMIN_EMAIL",
  "VAQCROW_SUPERADMIN_PASSWORD"
] as const;

export interface SeedEnv {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
  readonly email: string;
  readonly password: string;
}

/** Reports missing variables by name only, never by value. */
export function parseSeedEnv(
  env: Readonly<Record<string, string | undefined>>
): { readonly ok: true; readonly value: SeedEnv } | { readonly ok: false; readonly missing: readonly string[] } {
  const read = (name: (typeof SEED_ENV_NAMES)[number]): string | undefined => {
    const value = env[name]?.trim();
    return value === undefined || value === "" ? undefined : value;
  };
  const values = SEED_ENV_NAMES.map((name) => [name, read(name)] as const);
  const missing = values.filter(([, value]) => value === undefined).map(([name]) => name);
  if (missing.length > 0) {
    return { ok: false, missing };
  }
  const [url, key, email, password] = values.map(([, value]) => value as string);
  return {
    ok: true,
    value: { supabaseUrl: url as string, serviceRoleKey: key as string, email: email as string, password: password as string }
  };
}

export async function runSeedSuperAdmin(deps: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly createClient: (supabaseUrl: string, serviceRoleKey: string) => SeedClient;
  readonly print: (line: string) => void;
}): Promise<number> {
  const parsed = parseSeedEnv(deps.env);
  if (!parsed.ok) {
    deps.print(`Cannot seed the super admin; set: ${parsed.missing.join(", ")}`);
    return 1;
  }

  const { supabaseUrl, serviceRoleKey, email, password } = parsed.value;
  const outcome = await seedSuperAdmin({ client: deps.createClient(supabaseUrl, serviceRoleKey), email, password });

  switch (outcome.status) {
    case "created":
      deps.print(`Super admin created (user ${outcome.userId}, username ${SUPERADMIN_USERNAME}).`);
      return 0;
    case "already_present":
      deps.print(`Super admin already present (user ${outcome.userId}); nothing changed.`);
      return 0;
    case "refused":
      deps.print(`Refused: user ${outcome.userId} is not an active ADMIN. ${outcome.reason}`);
      return 1;
    case "failed":
      deps.print(`Seed failed: ${outcome.reason}`);
      return 1;
  }
}

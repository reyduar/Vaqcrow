/**
 * Reset the demo's test data (reusable, guarded).
 *
 * Run per profile with
 * `RESET_DEMO_DATA_CONFIRM=yes pnpm --filter @vaqcrow/api reset:demo-data:docker|cloud`.
 * It is never invoked by `index.ts`, and it is **destructive**: it deletes every
 * application, campaign, contribution, distribution, document, sale, notification
 * and challenge, plus every account except the super admin. It keeps two things on
 * purpose:
 *
 * - the super admin (resolved from `VAQCROW_SUPERADMIN_EMAIL`; the run refuses if
 *   it cannot find exactly one active ADMIN, so it can never delete the admin by
 *   accident); and
 * - the `fx_rate` row (`POST /campaigns` answers `rate_unavailable` without it).
 *
 * Guards, in order: the `RESET_DEMO_DATA_CONFIRM` variable must be `yes`; the
 * super admin email must be set and resolve to an active ADMIN. Anything else is
 * a loud refusal with nothing deleted.
 *
 * The database deletes go through PostgREST (`delete()` with an always-true
 * `not(column, "is", null)` filter — PostgREST refuses an unfiltered DELETE),
 * child-first so foreign keys never block. Storage objects are removed through
 * the Storage API (a SQL delete would leave the blobs behind); the bucket is
 * walked recursively because `list` is not recursive.
 */

const LIST_PAGE_SIZE = 200;
const LIST_MAX_PAGES = 50;
const STORAGE_BUCKET = "pyme-documents";
const STORAGE_LIST_PAGE = 1000;
const STORAGE_MAX_DEPTH = 6;
const STORAGE_REMOVE_BATCH = 100;

interface ProviderError {
  readonly code?: string;
  readonly status?: number;
  readonly message?: string;
}

/** The slice of `SupabaseClient` the reset needs, so tests can inject a fake. */
export interface ResetClient {
  readonly auth: {
    readonly admin: {
      listUsers(params: {
        page: number;
        perPage: number;
      }): Promise<{ data: { users: Array<{ id: string; email?: string }> }; error: ProviderError | null }>;
      deleteUser(id: string): Promise<{ error: ProviderError | null }>;
    };
  };
  readonly from: (table: string) => {
    select(columns: string): {
      eq(
        column: string,
        value: string
      ): { maybeSingle(): Promise<{ data: { role: string; status: string } | null; error: ProviderError | null }> };
    };
    delete(): {
      not(
        column: string,
        operator: "is",
        value: null
      ): Promise<{ error: ProviderError | null }>;
      neq(column: string, value: string): Promise<{ error: ProviderError | null }>;
    };
  };
  readonly storage: {
    from(bucket: string): {
      list(
        prefix: string,
        options: { limit: number }
      ): Promise<{ data: Array<{ name: string; id: string | null; metadata: unknown }> | null; error: ProviderError | null }>;
      remove(paths: string[]): Promise<{ error: ProviderError | null }>;
    };
  };
}

/**
 * The activity tables, in the order they must be emptied (children before
 * parents). `filter` is a NOT NULL column used only to satisfy PostgREST's
 * "no unfiltered delete" rule — the filter matches every row.
 */
export const RESET_TABLES: readonly { readonly table: string; readonly filter: string }[] = [
  { table: "campaign_refund_contact", filter: "campaign_id" },
  { table: "campaign_contribution_transaction", filter: "transaction_hash" },
  { table: "campaign_contribution", filter: "campaign_id" },
  { table: "campaign_favorite", filter: "campaign_id" },
  { table: "revenue_share_distribution_recipient", filter: "distribution_id" },
  { table: "revenue_share_distribution", filter: "distribution_id" },
  { table: "campaign_deployment", filter: "application_id" },
  { table: "campaign", filter: "campaign_id" },
  { table: "document_verdict", filter: "application_id" },
  { table: "human_decision", filter: "decision_id" },
  { table: "application_assessment", filter: "application_id" },
  { table: "assessment_failure_handoff", filter: "application_id" },
  { table: "sme_request", filter: "application_id" },
  { table: "application_review", filter: "application_id" },
  { table: "business_sales_period", filter: "business_id" },
  { table: "businesses", filter: "id" },
  { table: "pyme_document", filter: "id" },
  { table: "notification", filter: "id" },
  { table: "investor_kyc", filter: "user_id" },
  { table: "wallet_challenge", filter: "challenge_id" },
  { table: "audit_log", filter: "id" },
  { table: "funding_intent_legacy", filter: "intent_id" }
] as const;

/** Tables kept on purpose — asserted by the CLI's final summary. */
export const RESET_KEPT_TABLES: readonly string[] = ["fx_rate", "profile (admin)"] as const;

export type ResetOutcome =
  | { readonly status: "refused"; readonly reason: string }
  | { readonly status: "failed"; readonly reason: string }
  | {
      readonly status: "done";
      readonly tablesCleared: number;
      readonly usersDeleted: number;
      readonly objectsDeleted: number;
    };

const failed = (reason: string): ResetOutcome => ({ status: "failed", reason });
const describe = (error: ProviderError): string =>
  `provider error code ${error.code ?? "unknown"} (HTTP ${error.status ?? "unknown"})`;

type Lookup =
  | { readonly kind: "found"; readonly userId: string }
  | { readonly kind: "absent" }
  | { readonly kind: "error"; readonly reason: string };

async function findUserIdsByEmail(client: ResetClient): Promise<{ ok: true; users: Array<{ id: string; email?: string }> } | { ok: false; reason: string }> {
  const all: Array<{ id: string; email?: string }> = [];
  for (let page = 1; page <= LIST_MAX_PAGES; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: LIST_PAGE_SIZE });
    if (error) {
      return { ok: false, reason: describe(error) };
    }
    all.push(...data.users);
    if (data.users.length < LIST_PAGE_SIZE) {
      return { ok: true, users: all };
    }
  }
  return { ok: false, reason: `listUsers did not finish within ${LIST_MAX_PAGES} pages` };
}

async function resolveAdmin(client: ResetClient, email: string): Promise<Lookup> {
  const listed = await findUserIdsByEmail(client);
  if (!listed.ok) {
    return { kind: "error", reason: listed.reason };
  }
  const wanted = email.toLowerCase();
  const match = listed.users.find((user) => user.email?.toLowerCase() === wanted);
  return match ? { kind: "found", userId: match.id } : { kind: "absent" };
}

/** Every file path under `prefix`, walked recursively (Storage `list` is not recursive). */
async function collectStoragePaths(client: ResetClient, prefix: string, depth: number): Promise<string[]> {
  const { data, error } = await client.storage.from(STORAGE_BUCKET).list(prefix, { limit: STORAGE_LIST_PAGE });
  if (error) {
    throw new Error(`storage list failed: ${describe(error)}`);
  }
  const paths: string[] = [];
  for (const entry of data ?? []) {
    const full = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.id === null || entry.metadata === null) {
      if (depth < STORAGE_MAX_DEPTH) {
        paths.push(...(await collectStoragePaths(client, full, depth + 1)));
      }
    } else {
      paths.push(full);
    }
  }
  return paths;
}

export async function resetDemoData(input: {
  readonly client: ResetClient;
  readonly superAdminEmail: string;
}): Promise<ResetOutcome> {
  const { client, superAdminEmail } = input;

  const lookup = await resolveAdmin(client, superAdminEmail);
  if (lookup.kind === "error") {
    return failed(`could not list the accounts: ${lookup.reason}`);
  }
  if (lookup.kind === "absent") {
    return { status: "refused", reason: `no account matches VAQCROW_SUPERADMIN_EMAIL; nothing was deleted` };
  }
  const adminId = lookup.userId;

  const adminProfile = await client
    .from("profile")
    .select("role, status")
    .eq("user_id", adminId)
    .maybeSingle();
  if (adminProfile.error) {
    return failed(`could not read the admin profile: ${describe(adminProfile.error)}`);
  }
  if (adminProfile.data?.role !== "ADMIN" || adminProfile.data.status !== "active") {
    return {
      status: "refused",
      reason: `the account for VAQCROW_SUPERADMIN_EMAIL is not an active ADMIN; nothing was deleted`
    };
  }

  // Activity tables, child-first.
  for (const { table, filter } of RESET_TABLES) {
    const { error } = await client.from(table).delete().not(filter, "is", null);
    if (error) {
      return failed(`deleting ${table} failed: ${describe(error)}`);
    }
  }

  // Every profile except the admin (cascades to its documents/kyc/notifications…).
  const profileDelete = await client.from("profile").delete().neq("user_id", adminId);
  if (profileDelete.error) {
    return failed(`deleting the non-admin profiles failed: ${describe(profileDelete.error)}`);
  }

  // Every auth user except the admin.
  const listed = await findUserIdsByEmail(client);
  if (!listed.ok) {
    return failed(`could not list the accounts to delete: ${listed.reason}`);
  }
  let usersDeleted = 0;
  for (const user of listed.users) {
    if (user.id === adminId) continue;
    const { error } = await client.auth.admin.deleteUser(user.id);
    if (error) {
      return failed(`deleting user ${user.id} failed: ${describe(error)}`);
    }
    usersDeleted += 1;
  }

  // Storage objects (a SQL delete would leave the blobs).
  let objectsDeleted = 0;
  try {
    const paths = await collectStoragePaths(client, "", 0);
    for (let index = 0; index < paths.length; index += STORAGE_REMOVE_BATCH) {
      const batch = paths.slice(index, index + STORAGE_REMOVE_BATCH);
      const { error } = await client.storage.from(STORAGE_BUCKET).remove(batch);
      if (error) {
        return failed(`removing ${batch.length} storage object(s) failed: ${describe(error)}`);
      }
      objectsDeleted += batch.length;
    }
  } catch (error) {
    return failed(error instanceof Error ? error.message : "unknown storage failure");
  }

  return { status: "done", tablesCleared: RESET_TABLES.length, usersDeleted, objectsDeleted };
}

export const RESET_ENV_NAMES = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VAQCROW_SUPERADMIN_EMAIL"] as const;
export const RESET_CONFIRM_VARIABLE = "RESET_DEMO_DATA_CONFIRM";
export const RESET_CONFIRM_VALUE = "yes";

export interface ResetEnv {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
  readonly superAdminEmail: string;
}

/** Reports missing variables by name only, never by value. */
export function parseResetEnv(
  env: Readonly<Record<string, string | undefined>>
): { readonly ok: true; readonly value: ResetEnv } | { readonly ok: false; readonly missing: readonly string[] } {
  const read = (name: string): string | undefined => {
    const value = env[name]?.trim();
    return value === undefined || value === "" ? undefined : value;
  };
  const missing = RESET_ENV_NAMES.filter((name) => read(name) === undefined);
  if (missing.length > 0) {
    return { ok: false, missing };
  }
  return {
    ok: true,
    value: {
      supabaseUrl: read("SUPABASE_URL") as string,
      serviceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY") as string,
      superAdminEmail: read("VAQCROW_SUPERADMIN_EMAIL") as string
    }
  };
}

export async function runResetDemoData(deps: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly createClient: (supabaseUrl: string, serviceRoleKey: string) => ResetClient;
  readonly print: (line: string) => void;
}): Promise<number> {
  if (deps.env[RESET_CONFIRM_VARIABLE]?.trim() !== RESET_CONFIRM_VALUE) {
    deps.print(
      `Refused: set ${RESET_CONFIRM_VARIABLE}=${RESET_CONFIRM_VALUE} to run this destructive reset ` +
        `(it deletes every account except the super admin).`
    );
    return 1;
  }

  const parsed = parseResetEnv(deps.env);
  if (!parsed.ok) {
    deps.print(`Cannot reset the demo data; set: ${parsed.missing.join(", ")}`);
    return 1;
  }

  const { supabaseUrl, serviceRoleKey, superAdminEmail } = parsed.value;
  const outcome = await resetDemoData({ client: deps.createClient(supabaseUrl, serviceRoleKey), superAdminEmail });

  switch (outcome.status) {
    case "done":
      deps.print(
        `Demo data reset: ${outcome.tablesCleared} activity tables cleared, ` +
          `${outcome.usersDeleted} account(s) deleted, ${outcome.objectsDeleted} storage object(s) deleted. ` +
          `Kept: the super admin (${superAdminEmail}) and ${RESET_KEPT_TABLES.join(", ")}.`
      );
      return 0;
    case "refused":
      deps.print(`Refused: ${outcome.reason}`);
      return 1;
    case "failed":
      deps.print(`Reset failed: ${outcome.reason}`);
      return 1;
  }
}

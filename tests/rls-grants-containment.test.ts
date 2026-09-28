import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Issue [#196](https://github.com/reyduar/Vaqcrow/issues/196) resolves the RLS
 * gap on `public.application_review` and `public.human_decision` as a recorded
 * decision, not as policies: both tables have RLS enabled with zero policies,
 * and the access decision is made today by the GRANT layer, where `anon` and
 * `authenticated` hold nothing.
 *
 * That equilibrium is fragile by construction — it is one `grant` statement
 * away from unrestricted row-level access, because there is no policy to filter
 * anything. This test makes the equilibrium enforceable: it walks
 * `supabase/migrations/*.sql` in filename order and fails if any migration
 * grants either table to `anon` or `authenticated`.
 *
 * It derives its input from the migration files rather than a hand-maintained
 * list, and it asserts that it actually FOUND the revocations — a containment
 * test that silently stops matching is worse than no test. The scan strips
 * line comments first, so a migration may explain the boundary in prose
 * (`-- ... from anon, authenticated ...`) without tripping it.
 *
 * The decision itself, and why the policies are deferred until an identity
 * model exists, live in
 * `docs/architecture/identity-and-rls-boundaries.md`.
 */

const MIGRATIONS_SRC = fileURLToPath(new URL("../supabase/migrations", import.meta.url));

/** The two tables this decision covers as a pair. */
const TABLES: readonly string[] = ["application_review", "human_decision"];

/** Roles that must never hold a grant on either table. */
const AUDIENCE_ROLES = new Set(["anon", "authenticated"]);

interface ScannedStatement {
  readonly file: string;
  readonly sql: string;
}

/**
 * A migration file, split into canonical statements: comments removed, each
 * `;`-terminated chunk lowercased and whitespace-collapsed. Postgres accepts a
 * statement split across lines, so the raw text is not comparable line by line.
 */
export function statementsIn(text: string): readonly string[] {
  return text
    .replace(/--[^\n]*/g, " ")
    .split(";")
    .map((chunk) => chunk.replace(/\s+/g, " ").trim().toLowerCase())
    .filter((chunk) => chunk.length > 0);
}

/** The role list a statement hands access to or takes it from. */
function rolesAfter(statement: string, preposition: "from" | "to"): readonly string[] {
  const match = statement.match(new RegExp(`\\b${preposition}\\s+([^;]+)$`));

  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(",")
    .map((role) => role.trim())
    .filter((role) => role.length > 0);
}

/** Does this statement `revoke` access from both `anon` and `authenticated`? */
export function revokesAudienceAccess(statement: string): boolean {
  if (!statement.startsWith("revoke ")) {
    return false;
  }

  const roles = rolesAfter(statement, "from");
  return roles.includes("anon") && roles.includes("authenticated");
}

/** Does this statement `grant` access to `anon` or `authenticated`? */
export function grantsAudienceAccess(statement: string): boolean {
  if (!statement.startsWith("grant ")) {
    return false;
  }

  return rolesAfter(statement, "to").some((role) => AUDIENCE_ROLES.has(role));
}

/** Does this statement operate on the given `public.<table>`? */
export function targetsTable(statement: string, table: string): boolean {
  return new RegExp(`\\bon\\s+public\\.${table}\\b`).test(statement);
}

function migrationFiles(): readonly string[] {
  return readdirSync(MIGRATIONS_SRC)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/** Every statement of every migration, in filename order, tagged with its file. */
function scanMigrations(): readonly ScannedStatement[] {
  return migrationFiles().flatMap((file) =>
    statementsIn(readFileSync(join(MIGRATIONS_SRC, file), "utf8")).map((sql) => ({ file, sql }))
  );
}

const MIGRATION_STATEMENTS = scanMigrations();

describe("the scanner itself", () => {
  it("splits a migration into normalized statements and drops comments", () => {
    const statements = statementsIn(
      "-- explains `from anon, authenticated` in prose\n" +
        "revoke all on public.application_review\n" +
        "  from anon, authenticated;\n" +
        "grant select on public.application_review to service_role;\n"
    );

    expect(statements).toEqual([
      "revoke all on public.application_review from anon, authenticated",
      "grant select on public.application_review to service_role"
    ]);
  });

  it("recognizes a revocation that covers both audience roles", () => {
    expect(revokesAudienceAccess("revoke all on public.human_decision from anon, authenticated")).toBe(true);
    expect(revokesAudienceAccess("revoke all on public.human_decision from anon, authenticated, service_role")).toBe(
      true
    );
  });

  it("does not treat a partial revocation as covering the audience", () => {
    // A revoke from `service_role` alone says nothing about `anon`.
    expect(revokesAudienceAccess("revoke all on public.human_decision from service_role")).toBe(false);
    expect(revokesAudienceAccess("revoke all on public.human_decision from anon")).toBe(false);
    expect(revokesAudienceAccess("revoke all on public.human_decision from authenticated")).toBe(false);
  });

  it("recognizes a grant to an audience role, including a role list", () => {
    expect(grantsAudienceAccess("grant select on public.application_review to anon")).toBe(true);
    expect(grantsAudienceAccess("grant all on public.human_decision to authenticated")).toBe(true);
    expect(grantsAudienceAccess("grant select on public.human_decision to service_role, anon")).toBe(true);
  });

  it("does not confuse a function grant with a table grant", () => {
    // `record_human_decision` is a function, not the `human_decision` table.
    const functionGrant = "grant execute on function public.record_human_decision ( uuid, uuid ) to service_role";

    expect(grantsAudienceAccess(functionGrant)).toBe(false);
    expect(targetsTable(functionGrant, "human_decision")).toBe(false);
  });

  it("does not match a longer identifier as a table name", () => {
    // `human_decision_audit` used to exist; `human_decision` must not match it.
    expect(targetsTable("grant select on public.human_decision_audit to anon", "human_decision")).toBe(false);
  });
});

describe("the scanned migration set", () => {
  it("covers the migrations, so a clean result means something", () => {
    // A scanner pointed at an empty tree reports success too. Every migration
    // that creates one of the two tables must still carry its revocation.
    expect(migrationFiles().length).toBeGreaterThanOrEqual(4);

    for (const table of TABLES) {
      const revocations = MIGRATION_STATEMENTS.filter(
        (statement) => targetsTable(statement.sql, table) && revokesAudienceAccess(statement.sql)
      );

      expect(
        revocations.length,
        `no migration revokes access to \`public.${table}\` from anon/authenticated. ` +
          "Without that revocation the table relies on an absent grant for containment; if it is gone, " +
          "this test would pass vacuously."
      ).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("grant containment", () => {
  it("grants nothing on application_review or human_decision to anon or authenticated", () => {
    const offenders = MIGRATION_STATEMENTS.filter(
      (statement) =>
        TABLES.some((table) => targetsTable(statement.sql, table)) && grantsAudienceAccess(statement.sql)
    ).map((statement) => `${statement.file}: ${statement.sql}`);

    expect(
      offenders,
      `a migration grants one of the RLS-enabled tables to anon/authenticated: ${offenders.join("; ")}. ` +
        "Both tables have RLS enabled with zero policies, so any grant to a non-service role is " +
        "unrestricted row-level access — see docs/architecture/identity-and-rls-boundaries.md."
    ).toEqual([]);
  });
});

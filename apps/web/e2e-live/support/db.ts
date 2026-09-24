import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { LIVE_DB_CONTAINER } from "./live-targets";

/**
 * Seeds one approved `application_review` row directly in the Supabase local
 * database, the same shape `supabase/migrations/20260918114635_create_application_review.sql`
 * declares. The API exposes no route that creates this row (it is normally
 * written by the assessment/human-decision flow, out of scope here), so the
 * live campaign-vault journey needs its own approved application to open a
 * vault against — exactly the gap `odd/tasks/campaign-vault-web-journey.md`'s
 * own local verification ran into and worked around the same way (CLAUDE.md:
 * "Once the local migration test passes… `docker exec -i supabase_db_vaqcrow
 * psql …`").
 *
 * A fresh UUID per call (never reused across tests) means no cleanup is
 * required for isolation: `openCampaign` keys its idempotent replay check on
 * `applicationId`, so two tests never collide even if their rows are never
 * deleted. The local Supabase database is disposable dev/test state, the same
 * assumption `test:integration` and the local-network verification already
 * make.
 */
export interface SeededApplication {
  readonly applicationId: string;
  readonly correlationId: string;
}

/** Runs one SQL statement against the local Supabase Postgres container. No secrets ever appear in the command or its output. */
function runPsql(sql: string): void {
  const result = spawnSync(
    "docker",
    ["exec", "-i", LIVE_DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8", timeout: 15_000 }
  );

  if (result.error) {
    throw new Error(
      `Could not reach the local Supabase database container "${LIVE_DB_CONTAINER}" (${result.error.message}). ` +
        "Is the docker profile up? See docs/architecture/environments.md §11."
    );
  }

  if (result.status !== 0) {
    throw new Error(`psql exited ${String(result.status)} seeding the local database:\n${result.stderr}`);
  }
}

/**
 * Inserts one `approved` application review so `POST /campaigns` accepts it.
 * `applicationId` defaults to a fresh uuid (every direct-API-opened campaign
 * in scenarios b–d gets its own). The one caller that must pass a fixed id
 * is the real "Abrir bóveda" form (`campaign-workspace.tsx`'s
 * `applicationId = DEMO_APPLICATION_ID` default, never overridden by the
 * actual `/funding` route) — that application can only ever have *one*
 * campaign (`campaign.application_id` is effectively 1:1 with a vault), so
 * `on conflict … do nothing` makes seeding it safe to repeat across live
 * suite runs against the same local database.
 */
export function seedApprovedApplication(applicationId: string = randomUUID()): SeededApplication {
  const correlationId = randomUUID();

  runPsql(
    `insert into public.application_review (application_id, state, last_correlation_id) ` +
      `values ('${applicationId}', 'approved', '${correlationId}') ` +
      `on conflict (application_id) do nothing;`
  );

  return { applicationId, correlationId };
}

import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { LIVE_DB_CONTAINER } from "./live-targets";

/**
 * Seeds one approved `application_review` row directly in the Supabase local
 * database, the same shape `supabase/migrations/20260918114635_create_application_review.sql`
 * declares. The API exposes no route that creates this row (it is normally
 * written by the assessment/human-decision flow, out of scope here), so the
 * live campaign-vault journey inserts its own approved application (no seed
 * file is involved; `supabase/seed/` was retired) to open a vault against —
 * exactly the gap `odd/tasks/campaign-vault-web-journey.md`'s own local verification ran into and worked around the same way (CLAUDE.md:
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

/** Runs one read query and returns its tuples-only, unaligned output (`psql -At`). */
function queryPsql(sql: string): string {
  const result = spawnSync(
    "docker",
    ["exec", "-i", LIVE_DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8", timeout: 15_000 }
  );
  if (result.error) {
    throw new Error(`Could not reach the local Supabase database container "${LIVE_DB_CONTAINER}" (${result.error.message}).`);
  }
  if (result.status !== 0) {
    throw new Error(`psql exited ${String(result.status)} querying the local database:\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Not a uuid: ${value}`);
  }
}

/** The persisted `businesses` row behind one application (via `sme_request.owner_user_id`). */
export function businessForApplication(applicationId: string): {
  readonly businessId: string;
  readonly goalArs: bigint;
  readonly deadline: string | null;
  /** The duration the PyME chose in the wizard (#410/U13); `null` for a legacy row. */
  readonly campaignDurationDays: number | null;
} {
  assertUuid(applicationId);
  const row = queryPsql(
    `select b.id, b.goal_ars, coalesce(b.deadline::text, ''), coalesce(b.campaign_duration_days::text, '') ` +
      `from public.businesses b ` +
      `join public.sme_request s on s.owner_user_id = b.owner_user_id ` +
      `where s.application_id = '${applicationId}' order by b.created_at desc limit 1;`
  );
  const [businessId, goalArs, deadline, duration] = row.split("|");
  if (!businessId || !goalArs) throw new Error(`No business row found for application ${applicationId}`);
  return {
    businessId,
    goalArs: BigInt(goalArs),
    deadline: deadline ? deadline : null,
    campaignDurationDays: duration ? Number(duration) : null
  };
}

/** Read-only snapshot of where an application's assessment stands (U12 polls it; nothing is written). */
export interface AssessmentStatus {
  readonly state: string;
  /** The recorded assessment's attempt key: the application id when the submission started it (U12). */
  readonly attemptId: string | null;
  readonly riskBand: string | null;
  readonly source: string | null;
  /** Set when the assessment failed and the application was handed to manual review. */
  readonly failureCode: string | null;
  /** Seconds from the review row's creation (the submission) to the recorded assessment or handoff. */
  readonly secondsToOutcome: number | null;
}

export function assessmentStatusFor(applicationId: string): AssessmentStatus {
  assertUuid(applicationId);
  const row = queryPsql(
    `select r.state, coalesce(a.attempt_id::text, ''), coalesce(a.assessment->>'riskBand', ''), ` +
      `coalesce(a.metadata->>'source', ''), coalesce(h.failure_code, ''), ` +
      `coalesce(round(extract(epoch from coalesce(a.created_at, h.recorded_at) - r.created_at)::numeric, 1)::text, '') ` +
      `from public.application_review r ` +
      `left join public.application_assessment a on a.application_id = r.application_id ` +
      `left join public.assessment_failure_handoff h on h.application_id = r.application_id ` +
      `where r.application_id = '${applicationId}';`
  );
  const [state, attemptId, riskBand, source, failureCode, seconds] = row.split("|");
  if (!state) throw new Error(`No application_review row for ${applicationId}`);
  return {
    state,
    attemptId: attemptId ? attemptId : null,
    riskBand: riskBand ? riskBand : null,
    source: source ? source : null,
    failureCode: failureCode ? failureCode : null,
    secondsToOutcome: seconds ? Number(seconds) : null
  };
}

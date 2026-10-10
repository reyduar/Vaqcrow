import { spawnSync } from "node:child_process";
import { LIVE_DB_CONTAINER } from "./live-targets";

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

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationId, CorrelationId } from "@vaqcrow/contracts";
import type {
  CampaignDeploymentRecord,
  CampaignDeploymentRepositoryPort,
  CampaignDeploymentRepositoryResult,
  CampaignDeploymentState
} from "../../application/ports/campaign-deployment-repository-port.js";

/**
 * The Supabase adapter for the vault-deployment lifecycle (Feature #410, Task
 * #410 / T5b). The API connects as `service_role`, which bypasses the table's
 * RLS, and is the single writer.
 *
 * `markPending` is insert-if-absent: a unique violation returns the existing
 * row, so a confirmed deployment is never reset. `beginAttempt` reads the
 * current state/attempts/updated_at and then writes a conditional update
 * guarded by `state in ('pending','failed')` and the attempts read, or, to
 * reclaim an abandoned attempt (U8), by `state = 'deploying'`, the attempts
 * read and `updated_at < staleBefore`; a concurrent retry matches zero rows
 * and reports a conflict rather than double-incrementing. `last_error` only ever carries a code the application
 * chose; Postgres `message`/`details`/`hint` are logged server-side and never
 * cross this boundary.
 */

const TABLE = "campaign_deployment";
const UNIQUE_VIOLATION = "23505";
/** PostgREST's "no rows returned" from `.single()` when an update matched none. */
const POSTGREST_NO_ROWS = "PGRST116";

interface DeploymentColumns {
  readonly application_id?: unknown;
  readonly state?: unknown;
  readonly attempts?: unknown;
  readonly last_error?: unknown;
  readonly campaign_id?: unknown;
  readonly last_correlation_id?: unknown;
  readonly created_at?: unknown;
  readonly updated_at?: unknown;
}

const DEPLOYMENT_STATES: readonly CampaignDeploymentState[] = ["pending", "deploying", "confirmed", "failed"];

/** Whether a stored timestamp is strictly before the cutoff; anything unparseable is not. */
function isBefore(value: unknown, cutoff: string): boolean {
  if (typeof value !== "string") return false;
  const at = Date.parse(value);
  const limit = Date.parse(cutoff);
  return !Number.isNaN(at) && !Number.isNaN(limit) && at < limit;
}

export class SupabaseCampaignDeploymentRepository implements CampaignDeploymentRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async findByApplicationId(
    applicationId: ApplicationId
  ): Promise<CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select()
        .eq("application_id", applicationId)
        .maybeSingle();

      if (error) return this.failure(error);
      if (!data) return { ok: false, error: { code: "not_found" } };

      return { ok: true, value: this.toRecord(data) };
    } catch {
      return this.unavailable();
    }
  }

  async markPending(input: {
    readonly applicationId: ApplicationId;
    readonly correlationId: CorrelationId;
  }): Promise<CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .insert({
          application_id: input.applicationId,
          state: "pending",
          last_correlation_id: input.correlationId
        })
        .select()
        .single();

      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          // The row already exists, so this is a replay: return it untouched
          // (in particular, never overwrite a confirmed deployment).
          const existing = await this.findByApplicationId(input.applicationId);
          return existing.ok ? existing : this.unavailable();
        }
        return this.failure(error);
      }
      if (!data) return this.unavailable();

      return { ok: true, value: this.toRecord(data) };
    } catch {
      return this.unavailable();
    }
  }

  async beginAttempt(input: {
    readonly applicationId: ApplicationId;
    readonly correlationId: CorrelationId;
    readonly staleBefore: string;
  }): Promise<CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>> {
    try {
      const current = await this.client
        .from(TABLE)
        .select("state, attempts, updated_at")
        .eq("application_id", input.applicationId)
        .maybeSingle();

      if (current.error) return this.failure(current.error);
      if (!current.data) return { ok: false, error: { code: "not_found" } };

      const row = current.data as DeploymentColumns;
      const retrying = row.state === "pending" || row.state === "failed";
      const reclaiming = row.state === "deploying" && isBefore(row.updated_at, input.staleBefore);
      if (!retrying && !reclaiming) {
        return { ok: false, error: { code: "state_conflict" } };
      }
      if (typeof row.attempts !== "number" || !Number.isSafeInteger(row.attempts) || row.attempts < 0) {
        return this.unavailable();
      }

      const update = this.client
        .from(TABLE)
        .update({
          state: "deploying",
          attempts: row.attempts + 1,
          last_error: null,
          last_correlation_id: input.correlationId
        })
        .eq("application_id", input.applicationId);

      // Both guards also pin the attempts that were read, so of two concurrent
      // retries only one increments. A reclaim additionally requires the row to
      // still be stale: the trigger bumps `updated_at` on every write, so once
      // one reclaim lands the other matches zero rows.
      const guarded = reclaiming
        ? update.eq("state", "deploying").eq("attempts", row.attempts).lt("updated_at", input.staleBefore)
        : update.in("state", ["pending", "failed"]).eq("attempts", row.attempts);

      const { data, error } = await guarded.select().single();

      if (error) {
        return error.code === POSTGREST_NO_ROWS
          ? { ok: false, error: { code: "state_conflict" } }
          : this.failure(error);
      }
      if (!data) return { ok: false, error: { code: "state_conflict" } };

      return { ok: true, value: this.toRecord(data) };
    } catch {
      return this.unavailable();
    }
  }

  async markConfirmed(input: {
    readonly applicationId: ApplicationId;
    readonly campaignId: string;
    readonly correlationId: CorrelationId;
  }): Promise<CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>> {
    return this.mark(input.applicationId, input.correlationId, {
      state: "confirmed",
      campaign_id: input.campaignId,
      last_error: null
    });
  }

  async markFailed(input: {
    readonly applicationId: ApplicationId;
    readonly errorCode: string;
    readonly correlationId: CorrelationId;
  }): Promise<CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>> {
    return this.mark(input.applicationId, input.correlationId, {
      state: "failed",
      last_error: input.errorCode
    });
  }

  /**
   * A terminal write, owned by the attempt that began it (U8): the update only
   * matches a row still in `deploying` under this attempt's correlation id. Once
   * a stale reclaim took the row over (it rewrote `last_correlation_id`), a late
   * write from the abandoned attempt matches zero rows and reports
   * `state_conflict` instead of overwriting the new attempt's outcome.
   */
  private async mark(
    applicationId: ApplicationId,
    correlationId: CorrelationId,
    values: Record<string, unknown>
  ): Promise<CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .update({ ...values, last_correlation_id: correlationId })
        .eq("application_id", applicationId)
        .eq("state", "deploying")
        .eq("last_correlation_id", correlationId)
        .select()
        .single();

      if (error) {
        return error.code === POSTGREST_NO_ROWS
          ? { ok: false, error: { code: "state_conflict" } }
          : this.failure(error);
      }
      if (!data) return { ok: false, error: { code: "state_conflict" } };

      return { ok: true, value: this.toRecord(data) };
    } catch {
      return this.unavailable();
    }
  }

  /**
   * Rebuilds a stored row, refusing anything malformed so a corrupt read becomes
   * `unavailable` rather than a half-populated deployment.
   */
  private toRecord(row: unknown): CampaignDeploymentRecord {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new Error("malformed campaign deployment row");
    }

    const value = row as DeploymentColumns;
    const applicationId = value.application_id;
    const state = value.state;
    const attempts = value.attempts;
    const lastError = value.last_error;
    const campaignId = value.campaign_id;
    const lastCorrelationId = value.last_correlation_id;
    const createdAt = value.created_at;
    const updatedAt = value.updated_at;

    if (
      typeof applicationId !== "string" ||
      typeof state !== "string" ||
      !DEPLOYMENT_STATES.includes(state as CampaignDeploymentState) ||
      typeof attempts !== "number" ||
      !Number.isSafeInteger(attempts) ||
      attempts < 0 ||
      typeof lastCorrelationId !== "string" ||
      typeof createdAt !== "string" ||
      typeof updatedAt !== "string" ||
      (lastError !== undefined && lastError !== null && typeof lastError !== "string") ||
      (campaignId !== undefined && campaignId !== null && typeof campaignId !== "string")
    ) {
      throw new Error("malformed campaign deployment row");
    }

    return {
      applicationId: applicationId as ApplicationId,
      state: state as CampaignDeploymentState,
      attempts,
      ...(typeof lastError === "string" ? { lastError } : {}),
      ...(typeof campaignId === "string" ? { campaignId } : {}),
      lastCorrelationId: lastCorrelationId as CorrelationId,
      createdAt,
      updatedAt
    };
  }

  private failure(error: PostgrestError): CampaignDeploymentRepositoryResult<never> {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabaseCampaignDeploymentRepository] persistence error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });

    return { ok: false, error: { code: "unavailable" } };
  }

  private unavailable(): CampaignDeploymentRepositoryResult<never> {
    return { ok: false, error: { code: "unavailable" } };
  }
}

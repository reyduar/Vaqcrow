import { parseApplicationReviewSnapshot } from "@vaqcrow/contracts";
import type { ApplicationId, ApplicationReviewSnapshot, ApplicationReviewState, CorrelationId } from "@vaqcrow/contracts";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  ApplicationReviewRepositoryError,
  ApplicationReviewRepositoryPort,
  ApplicationReviewRepositoryResult,
  ApplicationReviewTransitionOutcome
} from "../../application/ports/application-review-repository-port.js";

const TABLE = "application_review";

// Postgres error codes this adapter maps explicitly; every other code (including the
// RLS-denial 42501) falls through to the generic "unavailable" outcome.
const POSTGRES_UNIQUE_VIOLATION = "23505";
const POSTGRES_CHECK_VIOLATION = "23514";

export class SupabaseApplicationReviewRepository implements ApplicationReviewRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: {
    applicationId: ApplicationId;
    state: ApplicationReviewState;
    correlationId: CorrelationId;
  }): Promise<ApplicationReviewRepositoryResult<ApplicationReviewSnapshot>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .insert({
          application_id: input.applicationId,
          state: input.state,
          last_correlation_id: input.correlationId
        })
        .select()
        .single();

      if (error) {
        return { ok: false, error: this.toRepositoryError(error, input.correlationId, input.applicationId) };
      }

      return { ok: true, value: this.toSnapshot(data) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findById(
    applicationId: ApplicationId
  ): Promise<ApplicationReviewRepositoryResult<ApplicationReviewSnapshot>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select()
        .eq("application_id", applicationId)
        .maybeSingle();

      if (error) {
        // findById has no CorrelationId in hand; log the lookup subject instead.
        return { ok: false, error: this.toRepositoryError(error, undefined, applicationId) };
      }

      if (!data) {
        return { ok: false, error: { code: "not_found" } };
      }

      return { ok: true, value: this.toSnapshot(data) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async transition(input: {
    applicationId: ApplicationId;
    from: ApplicationReviewState;
    to: ApplicationReviewState;
    correlationId: CorrelationId;
  }): Promise<ApplicationReviewRepositoryResult<ApplicationReviewTransitionOutcome>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .update({ state: input.to, last_correlation_id: input.correlationId })
        .eq("application_id", input.applicationId)
        .eq("state", input.from)
        .select();

      if (error) {
        return { ok: false, error: this.toRepositoryError(error, input.correlationId, input.applicationId) };
      }

      const rows = data as readonly unknown[];
      if (rows.length === 1) {
        return { ok: true, value: { applied: true, snapshot: this.toSnapshot(rows[0]) } };
      }

      return this.resolveZeroRowTransition(input.applicationId, input.to);
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /**
   * Zero rows matched the conditional UPDATE. Disambiguate with one follow-up SELECT
   * (design's "Zero-row disambiguation" decision): the row may not exist, may already
   * carry the target state (idempotent replay — success, not an error), or may hold a
   * different state entirely (a genuine conflict).
   */
  private async resolveZeroRowTransition(
    applicationId: ApplicationId,
    to: ApplicationReviewState
  ): Promise<ApplicationReviewRepositoryResult<ApplicationReviewTransitionOutcome>> {
    const current = await this.findById(applicationId);

    if (!current.ok) {
      return current;
    }

    if (current.value.state === to) {
      return { ok: true, value: { applied: false, snapshot: current.value } };
    }

    return { ok: false, error: { code: "state_conflict", actualState: current.value.state } };
  }

  private toSnapshot(row: unknown): ApplicationReviewSnapshot {
    const record = row as { application_id: unknown; state: unknown };
    return parseApplicationReviewSnapshot({ applicationId: record.application_id, state: record.state });
  }

  private toRepositoryError(
    error: PostgrestError,
    correlationId?: CorrelationId,
    applicationId?: ApplicationId
  ): ApplicationReviewRepositoryError {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabaseApplicationReviewRepository] persistence error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      correlationId,
      applicationId
    });

    switch (error.code) {
      case POSTGRES_UNIQUE_VIOLATION:
        return { code: "already_exists" };
      case POSTGRES_CHECK_VIOLATION:
        return { code: "invalid_state" };
      default:
        return { code: "unavailable" };
    }
  }
}

import {
  applicationReviewStateSchema,
  parseApplicationManualReviewContext,
  parseApplicationReviewSnapshot,
  parseAssessmentFailureHandoffCommand,
  parseHumanDecisionRecord
} from "@vaqcrow/contracts";
import type {
  ApplicationId,
  ApplicationManualReviewContext,
  ApplicationReviewSnapshot,
  ApplicationReviewState,
  AssessmentFailureHandoffCommand,
  AssessmentFailureHandoffRecord,
  CorrelationId,
  HumanDecisionCommand,
  HumanDecisionRecord
} from "@vaqcrow/contracts";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  ApplicationReviewRepositoryError,
  ApplicationReviewRepositoryPort,
  ApplicationReviewRepositoryResult,
  ApplicationReviewTransitionOutcome,
  AssessmentFailureHandoffRepositoryOutcome,
  HumanDecisionRepositoryOutcome
} from "../../application/ports/application-review-repository-port.js";

const TABLE = "application_review";
const ASSESSMENT_FAILURE_HANDOFF_TABLE = "assessment_failure_handoff";
const HUMAN_DECISION_TABLE = "human_decision";

// Postgres error codes this adapter maps explicitly; every other code (including the
// RLS-denial 42501) falls through to the generic "unavailable" outcome.
const POSTGRES_UNIQUE_VIOLATION = "23505";
const POSTGRES_CHECK_VIOLATION = "23514";
const RECORD_HUMAN_DECISION_FUNCTION = "record_human_decision";
const RECORD_ASSESSMENT_FAILURE_HANDOFF_FUNCTION = "record_assessment_failure_handoff";

type HumanDecisionResultKind =
  | "applied"
  | "replayed"
  | "not_found"
  | "state_conflict"
  | "idempotency_conflict";

interface HumanDecisionRpcRow {
  readonly result_kind: HumanDecisionResultKind;
  readonly decision_id?: unknown;
  readonly application_id?: unknown;
  readonly outcome?: unknown;
  readonly actor?: unknown;
  readonly reason?: unknown;
  readonly approved_limit_ars?: unknown;
  readonly decided_at?: unknown;
  readonly correlation_id?: unknown;
  readonly actual_state?: unknown;
}

type AssessmentFailureHandoffResultKind =
  | "applied"
  | "replayed"
  | "not_found"
  | "state_conflict"
  | "correlation_conflict";

interface AssessmentFailureHandoffRpcRow {
  readonly result_kind: AssessmentFailureHandoffResultKind;
  readonly application_id?: unknown;
  readonly correlation_id?: unknown;
  readonly failure_code?: unknown;
  readonly evidence_bundle?: unknown;
  readonly provider_provenance?: unknown;
  readonly recorded_at?: unknown;
  readonly actual_state?: unknown;
}

/** The columns the read path selects; the sanitized record has no provider diagnostics. */
interface AssessmentFailureHandoffReadRow {
  readonly application_id?: unknown;
  readonly failure_code?: unknown;
  readonly evidence_bundle?: unknown;
  readonly provider_provenance?: unknown;
  readonly recorded_at?: unknown;
}

/**
 * A plain `human_decision` table row. It is not `HumanDecisionRpcRow`: the RPC's
 * table-valued result carries a leading `result_kind` marker, whereas a table row
 * has no such column, so a table row must never be fed into the RPC mapper.
 */
interface HumanDecisionReadRow {
  readonly decision_id?: unknown;
  readonly application_id?: unknown;
  readonly outcome?: unknown;
  readonly actor?: unknown;
  readonly reason?: unknown;
  readonly approved_limit_ars?: unknown;
  readonly decided_at?: unknown;
  readonly correlation_id?: unknown;
}

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

  async recordHumanDecision(input: {
    command: HumanDecisionCommand;
    correlationId: CorrelationId;
  }): Promise<ApplicationReviewRepositoryResult<HumanDecisionRepositoryOutcome>> {
    const { command, correlationId } = input;

    try {
      const { data, error } = await this.client.rpc(RECORD_HUMAN_DECISION_FUNCTION, {
        p_decision_id: command.decisionId,
        p_application_id: command.applicationId,
        p_outcome: command.outcome,
        p_actor: command.actor,
        p_reason: command.reason,
        p_approved_limit_ars: command.approvedLimitArs,
        p_correlation_id: correlationId
      });

      if (error) {
        return {
          ok: false,
          error: this.toRepositoryError(error, correlationId, command.applicationId)
        };
      }

      if (!Array.isArray(data) || data.length !== 1) {
        return { ok: false, error: { code: "unavailable" } };
      }

      return this.mapHumanDecisionRpcRow(data[0]);
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async recordAssessmentFailureHandoff(
    command: AssessmentFailureHandoffCommand
  ): Promise<ApplicationReviewRepositoryResult<AssessmentFailureHandoffRepositoryOutcome>> {
    try {
      const { data, error } = await this.client.rpc(RECORD_ASSESSMENT_FAILURE_HANDOFF_FUNCTION, {
        p_application_id: command.applicationId,
        p_correlation_id: command.correlationId,
        p_failure_code: command.failureCode,
        p_evidence_bundle: command.evidence,
        // Explicit null so an absent provenance is a declared absence, not an omitted argument.
        p_provider_provenance: command.providerProvenance ?? null
      });

      if (error) {
        return {
          ok: false,
          error: this.toRepositoryError(error, command.correlationId, command.applicationId)
        };
      }

      if (!Array.isArray(data) || data.length !== 1) {
        return { ok: false, error: { code: "unavailable" } };
      }

      return this.mapAssessmentFailureHandoffRpcRow(data[0]);
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async readManualReviewContext(
    applicationId: ApplicationId
  ): Promise<ApplicationReviewRepositoryResult<ApplicationManualReviewContext>> {
    try {
      const { data, error } = await this.client
        .from(ASSESSMENT_FAILURE_HANDOFF_TABLE)
        .select()
        .eq("application_id", applicationId)
        .maybeSingle();

      if (error) {
        // A read has no correlation in hand; log the lookup subject instead.
        return { ok: false, error: this.toRepositoryError(error, undefined, applicationId) };
      }

      if (!data) {
        // No handoff row means no persisted manual-review context. Report that
        // truthfully rather than fabricating empty-but-successful content.
        return { ok: false, error: { code: "not_found" } };
      }

      const current = await this.findById(applicationId);
      if (!current.ok) {
        return current;
      }

      const row = data as AssessmentFailureHandoffReadRow;

      // Re-validate every stored column through the shared parser: a malformed
      // row is an `unavailable` outcome, never a record that silently widened.
      return {
        ok: true,
        value: parseApplicationManualReviewContext({
          applicationId: row.application_id,
          applicationState: current.value.state,
          failureCode: row.failure_code,
          evidence: row.evidence_bundle,
          ...(row.provider_provenance === null || row.provider_provenance === undefined
            ? {}
            : { providerProvenance: row.provider_provenance }),
          recordedAt: row.recorded_at
        })
      };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async readLatestHumanDecision(
    applicationId: ApplicationId
  ): Promise<ApplicationReviewRepositoryResult<HumanDecisionRecord>> {
    try {
      const { data, error } = await this.client
        .from(HUMAN_DECISION_TABLE)
        .select()
        .eq("application_id", applicationId)
        .order("decided_at", { ascending: false })
        // `decided_at` defaults to `now()` and could tie; a single sort column would
        // then leave which row is "latest" unspecified (R3-latest-decision-ordering).
        // `decision_id` is arbitrary but stable, so a tie still resolves to one row.
        .order("decision_id", { ascending: true })
        .limit(1);

      if (error) {
        // A read has no correlation in hand; log the lookup subject instead.
        return { ok: false, error: this.toRepositoryError(error, undefined, applicationId) };
      }

      const rows = data as readonly unknown[];
      if (rows.length === 0) {
        // No decision row means the application has no recorded decision yet.
        // Report that truthfully rather than fabricating empty-but-successful content.
        return { ok: false, error: { code: "not_found" } };
      }

      const row = rows[0] as HumanDecisionReadRow;

      // Re-validate every stored column through the shared parser: a malformed
      // row is an `unavailable` outcome, never a record that silently widened.
      return {
        ok: true,
        value: parseHumanDecisionRecord({
          decisionId: row.decision_id,
          applicationId: row.application_id,
          outcome: row.outcome,
          actor: row.actor,
          reason: row.reason,
          approvedLimitArs: this.normalizeBigint(row.approved_limit_ars),
          decidedAt: row.decided_at,
          correlationId: row.correlation_id
        })
      };
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

  private mapHumanDecisionRpcRow(
    value: unknown
  ): ApplicationReviewRepositoryResult<HumanDecisionRepositoryOutcome> {
    if (typeof value !== "object" || value === null || !("result_kind" in value)) {
      return { ok: false, error: { code: "unavailable" } };
    }

    const row = value as HumanDecisionRpcRow;
    switch (row.result_kind) {
      case "applied":
        return { ok: true, value: { record: this.toHumanDecisionRecord(row), applied: true } };
      case "replayed":
        return { ok: true, value: { record: this.toHumanDecisionRecord(row), applied: false } };
      case "not_found":
        return { ok: false, error: { code: "not_found" } };
      case "state_conflict":
        return {
          ok: false,
          error: {
            code: "state_conflict",
            actualState: applicationReviewStateSchema.parse(row.actual_state)
          }
        };
      case "idempotency_conflict":
        return { ok: false, error: { code: "idempotency_conflict" } };
      default:
        return { ok: false, error: { code: "unavailable" } };
    }
  }

  private toHumanDecisionRecord(row: HumanDecisionRpcRow): HumanDecisionRecord {
    return parseHumanDecisionRecord({
      decisionId: row.decision_id,
      applicationId: row.application_id,
      outcome: row.outcome,
      actor: row.actor,
      reason: row.reason,
      approvedLimitArs: this.normalizeBigint(row.approved_limit_ars),
      decidedAt: row.decided_at,
      correlationId: row.correlation_id
    });
  }

  private mapAssessmentFailureHandoffRpcRow(
    value: unknown
  ): ApplicationReviewRepositoryResult<AssessmentFailureHandoffRepositoryOutcome> {
    if (typeof value !== "object" || value === null || !("result_kind" in value)) {
      return { ok: false, error: { code: "unavailable" } };
    }

    const row = value as AssessmentFailureHandoffRpcRow;
    switch (row.result_kind) {
      case "applied":
        return { ok: true, value: { record: this.toAssessmentFailureHandoffRecord(row), applied: true } };
      case "replayed":
        return { ok: true, value: { record: this.toAssessmentFailureHandoffRecord(row), applied: false } };
      case "not_found":
        return { ok: false, error: { code: "not_found" } };
      case "state_conflict":
        return {
          ok: false,
          error: {
            code: "state_conflict",
            actualState: applicationReviewStateSchema.parse(row.actual_state)
          }
        };
      case "correlation_conflict":
        return { ok: false, error: { code: "correlation_conflict" } };
      default:
        return { ok: false, error: { code: "unavailable" } };
    }
  }

  /**
   * Rebuilds the sanitized record from the one row the RPC returned. The parser
   * re-validates every stored column, so a malformed row is an `unavailable`
   * outcome rather than a record that silently widened.
   */
  private toAssessmentFailureHandoffRecord(
    row: AssessmentFailureHandoffRpcRow
  ): AssessmentFailureHandoffRecord {
    return parseAssessmentFailureHandoffCommand({
      applicationId: row.application_id,
      correlationId: row.correlation_id,
      failureCode: row.failure_code,
      evidence: row.evidence_bundle,
      ...(row.provider_provenance === null || row.provider_provenance === undefined
        ? {}
        : { providerProvenance: row.provider_provenance })
    });
  }

  private normalizeBigint(value: unknown): unknown {
    if (value === null) {
      return null;
    }

    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) {
        throw new Error("Unsafe bigint result");
      }
      return value;
    }

    if (typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value)) {
      const integer = BigInt(value);
      if (integer >= BigInt(Number.MIN_SAFE_INTEGER) && integer <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number(integer);
      }
    }

    throw new Error("Malformed bigint result");
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

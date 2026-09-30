import { applicationReviewStateSchema, parseApplicationAssessmentRead } from "@vaqcrow/contracts";
import type {
  ApplicationAssessment,
  ApplicationAssessmentRead,
  ApplicationId,
  AssessmentHandoffId,
  AssessmentProviderProvenance,
  CorrelationId
} from "@vaqcrow/contracts";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  ApplicationAssessmentRecordOutcome,
  ApplicationAssessmentRepositoryPort,
  ApplicationAssessmentRepositoryResult
} from "../../application/ports/application-assessment-repository-port.js";

const TABLE = "application_assessment";
const RECORD_APPLICATION_ASSESSMENT_FUNCTION = "record_application_assessment";

interface RecordRpcRow {
  readonly result_kind?: unknown;
  readonly assessment?: unknown;
  readonly metadata?: unknown;
  readonly recorded_at?: unknown;
  readonly actual_state?: unknown;
}

interface AssessmentTableRow {
  readonly assessment?: unknown;
  readonly metadata?: unknown;
  readonly created_at?: unknown;
}

export class SupabaseApplicationAssessmentRepository implements ApplicationAssessmentRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async record(input: {
    applicationId: ApplicationId;
    attemptId: AssessmentHandoffId;
    correlationId: CorrelationId;
    assessment: ApplicationAssessment;
    metadata: AssessmentProviderProvenance;
  }): Promise<ApplicationAssessmentRepositoryResult<ApplicationAssessmentRecordOutcome>> {
    try {
      const { data, error } = await this.client.rpc(RECORD_APPLICATION_ASSESSMENT_FUNCTION, {
        p_application_id: input.applicationId,
        p_attempt_id: input.attemptId,
        p_correlation_id: input.correlationId,
        p_assessment: input.assessment,
        p_metadata: input.metadata
      });

      if (error) {
        this.logError(error, input.applicationId, input.correlationId);
        return { ok: false, error: { code: "unavailable" } };
      }

      if (!Array.isArray(data) || data.length !== 1) {
        return { ok: false, error: { code: "unavailable" } };
      }

      const row = data[0] as RecordRpcRow;
      switch (row.result_kind) {
        case "applied":
          return { ok: true, value: { record: this.toRecord(row), applied: true } };
        case "replayed":
          return { ok: true, value: { record: this.toRecord(row), applied: false } };
        case "not_found":
          return { ok: false, error: { code: "not_found" } };
        case "conflict":
          return { ok: false, error: { code: "attempt_conflict" } };
        case "state_conflict":
          return {
            ok: false,
            error: { code: "state_conflict", actualState: applicationReviewStateSchema.parse(row.actual_state) }
          };
        default:
          return { ok: false, error: { code: "unavailable" } };
      }
    } catch {
      // Includes a stored row that no longer satisfies the shared contract.
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findByApplicationId(
    applicationId: ApplicationId
  ): Promise<ApplicationAssessmentRepositoryResult<ApplicationAssessmentRead>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select()
        .eq("application_id", applicationId)
        .maybeSingle();

      if (error) {
        this.logError(error, applicationId);
        return { ok: false, error: { code: "unavailable" } };
      }

      if (!data) {
        return { ok: false, error: { code: "not_found" } };
      }

      const row = data as AssessmentTableRow;
      return {
        ok: true,
        value: this.toRecord({ assessment: row.assessment, metadata: row.metadata, recorded_at: row.created_at })
      };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /** Re-validates every stored column through the shared contract: a malformed row throws. */
  private toRecord(row: Pick<RecordRpcRow, "assessment" | "metadata" | "recorded_at">): ApplicationAssessmentRead {
    return parseApplicationAssessmentRead({
      assessment: row.assessment,
      metadata: row.metadata,
      recordedAt: row.recorded_at
    });
  }

  private logError(error: PostgrestError, applicationId: ApplicationId, correlationId?: CorrelationId): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabaseApplicationAssessmentRepository] persistence error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      correlationId,
      applicationId
    });
  }
}

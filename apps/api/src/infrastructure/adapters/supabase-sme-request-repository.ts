import { parseApplicationId, parseSmeRequest } from "@vaqcrow/contracts";
import type { ApplicationId, CorrelationId, SmeRequest } from "@vaqcrow/contracts";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  SmeRequestRecord,
  SmeRequestRepositoryError,
  SmeRequestRepositoryPort,
  SmeRequestRepositoryResult,
  SmeRequestSubmissionOutcome
} from "../../application/ports/sme-request-repository-port.js";

const TABLE = "sme_request";
const SUBMIT_SME_REQUEST_FUNCTION = "submit_sme_request";
const POSTGRES_CHECK_VIOLATION = "23514";

/** Columns shared by the RPC result and a plain table row. */
interface SmeRequestColumns {
  readonly application_id?: unknown;
  readonly sme_reference?: unknown;
  readonly declared_total_ars?: unknown;
  readonly period_start?: unknown;
  readonly period_end?: unknown;
}

interface SubmitRpcRow extends SmeRequestColumns {
  readonly result_kind?: unknown;
}

export class SupabaseSmeRequestRepository implements SmeRequestRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async submit(input: {
    applicationId: ApplicationId;
    request: SmeRequest;
    correlationId: CorrelationId;
  }): Promise<SmeRequestRepositoryResult<SmeRequestSubmissionOutcome>> {
    try {
      const { data, error } = await this.client.rpc(SUBMIT_SME_REQUEST_FUNCTION, {
        p_application_id: input.applicationId,
        p_correlation_id: input.correlationId,
        p_sme_reference: input.request.smeReference,
        p_declared_total_ars: input.request.declaredTotalArs,
        p_period_start: input.request.periodStart,
        p_period_end: input.request.periodEnd
      });

      if (error) {
        return { ok: false, error: this.toRepositoryError(error, input.correlationId, input.applicationId) };
      }

      if (!Array.isArray(data) || data.length !== 1) {
        return { ok: false, error: { code: "unavailable" } };
      }

      const row = data[0] as SubmitRpcRow;
      if (row.result_kind !== "applied" && row.result_kind !== "replayed") {
        return { ok: false, error: { code: "unavailable" } };
      }

      return { ok: true, value: { ...this.toRecord(row), applied: row.result_kind === "applied" } };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findByApplicationId(
    applicationId: ApplicationId
  ): Promise<SmeRequestRepositoryResult<SmeRequestRecord>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select()
        .eq("application_id", applicationId)
        .maybeSingle();

      if (error) {
        return { ok: false, error: this.toRepositoryError(error, undefined, applicationId) };
      }

      if (!data) {
        return { ok: false, error: { code: "not_found" } };
      }

      return { ok: true, value: this.toRecord(data as SmeRequestColumns) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /**
   * Rebuilds the record through the shared contract parsers, so a malformed
   * stored row throws (caught by the callers as `unavailable`) instead of
   * silently widening. The `simuladoLabel` is a constant of the contract, not a
   * stored column.
   */
  private toRecord(row: SmeRequestColumns): SmeRequestRecord {
    return {
      applicationId: parseApplicationId(row.application_id),
      request: parseSmeRequest({
        smeReference: row.sme_reference,
        declaredTotalArs: this.normalizeNumeric(row.declared_total_ars),
        periodStart: row.period_start,
        periodEnd: row.period_end,
        simuladoLabel: "SIMULADO"
      })
    };
  }

  // PostgREST returns `numeric` as a JSON number, but a string form is legal.
  private normalizeNumeric(value: unknown): unknown {
    if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value)) {
      return Number(value);
    }
    return value;
  }

  private toRepositoryError(
    error: PostgrestError,
    correlationId?: CorrelationId,
    applicationId?: ApplicationId
  ): SmeRequestRepositoryError {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabaseSmeRequestRepository] persistence error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      correlationId,
      applicationId
    });

    return error.code === POSTGRES_CHECK_VIOLATION ? { code: "invalid_request" } : { code: "unavailable" };
  }
}

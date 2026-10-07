import { applicationReviewStateSchema, parseApplicationId, parseSmeRequest } from "@vaqcrow/contracts";
import type { ApplicationId, CorrelationId, SmeRequest } from "@vaqcrow/contracts";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_QUEUE_RAW_STATES_BY_DISPLAY,
  MISSING_BUSINESS_LABEL
} from "../../application/ports/sme-request-repository-port.js";
import type {
  AdminQueueCounts,
  AdminQueueDisplayState,
  AdminQueueItem,
  AdminQueuePage,
  AdminQueueQuery,
  AdminQueueSortField,
  SmeRequestRecord,
  SmeRequestRepositoryError,
  SmeRequestRepositoryPort,
  SmeRequestRepositoryResult,
  SmeRequestSubmissionOutcome
} from "../../application/ports/sme-request-repository-port.js";

const TABLE = "sme_request";
const SUBMIT_SME_REQUEST_FUNCTION = "submit_sme_request";
const POSTGRES_CHECK_VIOLATION = "23514";

// The read-only join view (#386/T1): sme_request + application_review +
// businesses, exposed so the ADMIN queue's pagination/sort/search happen in the
// database (see 20261007120000_create_admin_sme_request_queue_view.sql).
const ADMIN_QUEUE_VIEW = "admin_sme_request_queue";

const QUEUE_COLUMN_BY_SORT: Readonly<Record<AdminQueueSortField, string>> = {
  applicationId: "application_id",
  name: "name",
  sector: "sector",
  state: "state",
  updatedAt: "updated_at"
};

const QUEUE_SEARCH_COLUMNS: readonly string[] = ["name", "application_id", "sector"];

/** Columns shared by the RPC result and a plain table row. */
interface SmeRequestColumns {
  readonly application_id?: unknown;
  readonly sme_reference?: unknown;
  readonly declared_total_ars?: unknown;
  readonly period_start?: unknown;
  readonly period_end?: unknown;
  readonly owner_user_id?: unknown;
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
    ownerUserId: string;
  }): Promise<SmeRequestRepositoryResult<SmeRequestSubmissionOutcome>> {
    try {
      const { data, error } = await this.client.rpc(SUBMIT_SME_REQUEST_FUNCTION, {
        p_application_id: input.applicationId,
        p_correlation_id: input.correlationId,
        p_owner_user_id: input.ownerUserId,
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

  async listAdminQueue(query: AdminQueueQuery): Promise<SmeRequestRepositoryResult<AdminQueuePage>> {
    try {
      const first = (query.page - 1) * query.pageSize;
      const last = first + query.pageSize - 1;

      const base = this.client
        .from(ADMIN_QUEUE_VIEW)
        .select("*", { count: "exact" })
        .order(QUEUE_COLUMN_BY_SORT[query.sort], { ascending: query.order === "asc" });

      const searched = query.search === undefined ? base : base.or(this.queueSearchFilter(query.search));
      const filtered =
        query.state === undefined
          ? searched
          : searched.in("state", [...ADMIN_QUEUE_RAW_STATES_BY_DISPLAY[query.state]]);

      // The page and the four global counts are independent reads; the counts
      // are never narrowed by the requested page or the active filter.
      const [pageResponse, counts] = await Promise.all([filtered.range(first, last), this.readDisplayCounts()]);

      const { data, error, count } = pageResponse;

      if (error) {
        // A read has no correlation in hand; the queue subject is the listing itself.
        return { ok: false, error: this.toRepositoryError(error) };
      }

      // Without an exact count the caller cannot paginate honestly, so a missing
      // count is `unavailable` rather than a page pretending to be whole.
      if (count === null || count === undefined) {
        return { ok: false, error: { code: "unavailable" } };
      }

      const rows = data as readonly unknown[];
      return { ok: true, value: { items: rows.map((row) => this.toQueueItem(row)), total: count, counts } };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /**
   * One count-only read per display group, each filtered to the raw review
   * states that group folds. PostgREST has no group-by, so this is four bounded
   * `HEAD` counts instead of a scan of every row; a failure is fatal so the
   * caller never renders fabricated KPIs.
   */
  private async readDisplayCounts(): Promise<AdminQueueCounts> {
    const displays = Object.keys(ADMIN_QUEUE_RAW_STATES_BY_DISPLAY) as AdminQueueDisplayState[];

    const entries = await Promise.all(
      displays.map(async (display) => {
        const { count, error } = await this.client
          .from(ADMIN_QUEUE_VIEW)
          .select("*", { count: "exact", head: true })
          .in("state", [...ADMIN_QUEUE_RAW_STATES_BY_DISPLAY[display]]);

        if (error) {
          this.toRepositoryError(error);
          throw new Error("queue display count failed");
        }

        if (count === null || count === undefined) {
          throw new Error("queue display count failed");
        }

        return [display, count] as const;
      })
    );

    return Object.fromEntries(entries) as AdminQueueCounts;
  }

  /**
   * Rebuilds one queue row. A missing company is the declared
   * `MISSING_BUSINESS_LABEL`; a malformed row (a non-string timestamp or an
   * unknown review state) throws and is caught by `listAdminQueue` as
   * `unavailable`, never silently widened.
   */
  private toQueueItem(row: unknown): AdminQueueItem {
    const record = row as {
      application_id?: unknown;
      name?: unknown;
      sector?: unknown;
      state?: unknown;
      updated_at?: unknown;
    };

    const updatedAt = record.updated_at;
    if (typeof updatedAt !== "string") {
      throw new Error("malformed queue row");
    }

    return {
      applicationId: parseApplicationId(record.application_id),
      name: this.businessLabel(record.name),
      sector: this.businessLabel(record.sector),
      state: applicationReviewStateSchema.parse(record.state),
      updatedAt
    };
  }

  /** The PostgREST `or` filter for the free-text search over the row's fields. */
  private queueSearchFilter(search: string): string {
    return QUEUE_SEARCH_COLUMNS.map((column) => `${column}.ilike.*${search}*`).join(",");
  }

  private businessLabel(value: unknown): string {
    if (value === null || value === undefined) return MISSING_BUSINESS_LABEL;
    if (typeof value === "string") return value;
    throw new Error("malformed queue row");
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
      }),
      ...(typeof row.owner_user_id === "string" ? { ownerUserId: row.owner_user_id } : {})
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

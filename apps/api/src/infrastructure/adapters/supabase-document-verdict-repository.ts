import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationId, DocumentVerdictRecord, DocumentVerdictValue } from "@vaqcrow/contracts";
import type {
  DocumentVerdictRepositoryPort,
  DocumentVerdictRepositoryResult,
  SetDocumentVerdictInput,
  SetDocumentVerdictOutcome
} from "../../application/ports/document-verdict-repository-port.js";

/**
 * The Supabase adapter for per-document KYC/KYB verdicts (Feature #410, U1,
 * decision D8). The API connects as `service_role`, which bypasses the table's
 * RLS, and is the single writer.
 *
 * `setVerdict` is current-value semantics without an upsert: it inserts first;
 * on a unique violation it writes a conditional update guarded by
 * `verdict <> $new`, so setting the value already stored matches zero rows and
 * is reported as a no-op replay (`applied: false`) with the existing row,
 * instead of re-stamping the actor or `updated_at`. A foreign-key violation (the
 * application or document row is gone) is `not_found`; any other Postgres error
 * is logged server-side and surfaces as a bare `unavailable` — `message`,
 * `details` and `hint` never cross this boundary.
 */

const TABLE = "document_verdict";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

const VERDICT_VALUES: readonly DocumentVerdictValue[] = ["valid", "request", "invalid"];

interface VerdictColumns {
  readonly document_id?: unknown;
  readonly verdict?: unknown;
  readonly actor?: unknown;
  readonly updated_at?: unknown;
}

export class SupabaseDocumentVerdictRepository implements DocumentVerdictRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async listByApplication(
    applicationId: ApplicationId
  ): Promise<DocumentVerdictRepositoryResult<readonly DocumentVerdictRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select()
        .eq("application_id", applicationId)
        .order("created_at", { ascending: true });

      if (error) return this.failure(error);
      if (!Array.isArray(data)) return this.unavailable();

      return { ok: true, value: data.map((row) => this.toRecord(row)) };
    } catch {
      return this.unavailable();
    }
  }

  async setVerdict(input: SetDocumentVerdictInput): Promise<DocumentVerdictRepositoryResult<SetDocumentVerdictOutcome>> {
    try {
      const inserted = await this.client
        .from(TABLE)
        .insert({
          application_id: input.applicationId,
          document_id: input.documentId,
          verdict: input.verdict,
          actor: input.actor,
          actor_user_id: input.actorUserId
        })
        .select()
        .single();

      if (!inserted.error) {
        return inserted.data ? this.applied(true, inserted.data) : this.unavailable();
      }
      if (inserted.error.code === FOREIGN_KEY_VIOLATION) return { ok: false, error: { code: "not_found" } };
      if (inserted.error.code !== UNIQUE_VIOLATION) return this.failure(inserted.error);

      // A row exists: change it only when the stored verdict differs, so a
      // replay with the same verdict matches zero rows and double-applies nothing.
      const updated = await this.client
        .from(TABLE)
        .update({ verdict: input.verdict, actor: input.actor, actor_user_id: input.actorUserId })
        .eq("application_id", input.applicationId)
        .eq("document_id", input.documentId)
        .neq("verdict", input.verdict)
        .select()
        .maybeSingle();

      if (updated.error) return this.failure(updated.error);
      if (updated.data) return this.applied(true, updated.data);

      const current = await this.client
        .from(TABLE)
        .select()
        .eq("application_id", input.applicationId)
        .eq("document_id", input.documentId)
        .maybeSingle();

      if (current.error) return this.failure(current.error);
      // The row existed a moment ago and the table has no delete grant, so a
      // missing row here is an unexpected state, not an absence.
      return current.data ? this.applied(false, current.data) : this.unavailable();
    } catch {
      return this.unavailable();
    }
  }

  private applied(applied: boolean, row: unknown): DocumentVerdictRepositoryResult<SetDocumentVerdictOutcome> {
    return { ok: true, value: { applied, verdict: this.toRecord(row) } };
  }

  /**
   * Rebuilds a stored row as the read shape, refusing anything malformed so a
   * corrupt read becomes `unavailable` rather than a half-populated verdict.
   */
  private toRecord(row: unknown): DocumentVerdictRecord {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new Error("malformed document verdict row");
    }

    const value = row as VerdictColumns;
    const { document_id: documentId, verdict, actor, updated_at: updatedAt } = value;

    if (
      typeof documentId !== "string" ||
      typeof verdict !== "string" ||
      !VERDICT_VALUES.includes(verdict as DocumentVerdictValue) ||
      typeof actor !== "string" ||
      actor.trim().length === 0 ||
      typeof updatedAt !== "string"
    ) {
      throw new Error("malformed document verdict row");
    }

    return { documentId, verdict: verdict as DocumentVerdictValue, actor, updatedAt };
  }

  private failure(error: PostgrestError): DocumentVerdictRepositoryResult<never> {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabaseDocumentVerdictRepository] persistence error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });

    return { ok: false, error: { code: "unavailable" } };
  }

  private unavailable(): DocumentVerdictRepositoryResult<never> {
    return { ok: false, error: { code: "unavailable" } };
  }
}

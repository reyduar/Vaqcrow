import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  PymeDocumentInput,
  PymeDocumentRecord,
  PymeDocumentRepositoryError,
  PymeDocumentRepositoryPort,
  PymeDocumentRepositoryResult
} from "../../application/ports/pyme-document-repository-port.js";

/**
 * The Supabase adapter for persisted PyME documents (content-relevance/vision
 * feature, U1). The API connects as `service_role`, which bypasses the table's
 * RLS, so every read here is scoped by `owner_user_id` and is the single
 * ownership enforcement point.
 *
 * Failures collapse to a sanitized code; Postgres's `message`/`details`/`hint`
 * are logged server-side and never cross this boundary.
 */

const TABLE = "pyme_document";
const POSTGRES_CHECK_VIOLATION = "23514";

interface PymeDocumentColumns {
  readonly id?: unknown;
  readonly owner_user_id?: unknown;
  readonly kind?: unknown;
  readonly object_path?: unknown;
  readonly name?: unknown;
  readonly size_bytes?: unknown;
  readonly content_type?: unknown;
  readonly created_at?: unknown;
}

export class SupabasePymeDocumentRepository implements PymeDocumentRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: PymeDocumentInput): Promise<PymeDocumentRepositoryResult<PymeDocumentRecord>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .insert({
          owner_user_id: input.ownerUserId,
          kind: input.kind,
          object_path: input.objectPath,
          name: input.name,
          size_bytes: input.sizeBytes,
          content_type: input.contentType
        })
        .select()
        .single();

      if (error) {
        return { ok: false, error: this.toRepositoryError(error) };
      }
      if (!data) {
        return { ok: false, error: { code: "unavailable" } };
      }

      return { ok: true, value: this.toRecord(data as PymeDocumentColumns) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async listByOwner(ownerUserId: string): Promise<PymeDocumentRepositoryResult<readonly PymeDocumentRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select()
        .eq("owner_user_id", ownerUserId)
        .order("created_at", { ascending: true });

      if (error) {
        return { ok: false, error: this.toRepositoryError(error) };
      }
      if (!Array.isArray(data)) {
        return { ok: false, error: { code: "unavailable" } };
      }

      return { ok: true, value: data.map((row) => this.toRecord(row as PymeDocumentColumns)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async deleteByObjectPath(objectPath: string): Promise<PymeDocumentRepositoryResult<void>> {
    try {
      const { error } = await this.client.from(TABLE).delete().eq("object_path", objectPath);

      if (error) {
        return { ok: false, error: this.toRepositoryError(error) };
      }

      // Zero matched rows is the idempotent success the port documents.
      return { ok: true, value: undefined };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /**
   * Rebuilds a stored row, refusing anything malformed so a corrupt read becomes
   * `unavailable` rather than a half-populated descriptor.
   */
  private toRecord(row: PymeDocumentColumns): PymeDocumentRecord {
    const documentId = row.id;
    const ownerUserId = row.owner_user_id;
    const createdAt = row.created_at;

    if (
      typeof documentId !== "string" ||
      typeof ownerUserId !== "string" ||
      typeof row.kind !== "string" ||
      typeof row.object_path !== "string" ||
      typeof row.name !== "string" ||
      typeof row.content_type !== "string" ||
      typeof createdAt !== "string"
    ) {
      throw new Error("malformed pyme_document row");
    }

    const sizeBytes = this.normalizeInteger(row.size_bytes);
    if (sizeBytes === undefined) {
      throw new Error("malformed pyme_document row");
    }

    return {
      documentId,
      ownerUserId,
      kind: row.kind as PymeDocumentRecord["kind"],
      objectPath: row.object_path,
      name: row.name,
      sizeBytes,
      contentType: row.content_type,
      createdAt
    };
  }

  private normalizeInteger(value: unknown): number | undefined {
    if (typeof value === "number") {
      return Number.isSafeInteger(value) ? value : undefined;
    }
    if (typeof value === "string" && /^-?\d+$/.test(value)) {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private toRepositoryError(error: PostgrestError): PymeDocumentRepositoryError {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabasePymeDocumentRepository] persistence error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });

    return error.code === POSTGRES_CHECK_VIOLATION ? { code: "invalid_request" } : { code: "unavailable" };
  }
}

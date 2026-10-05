import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  StoragePort,
  StoragePortError,
  StorageResult
} from "../../application/ports/storage-port.js";

/** The private bucket created by 20261003120000_create_pyme_documents_bucket.sql. */
const BUCKET = "pyme-documents";
const NOT_FOUND = "404";
const BAD_REQUEST = "400";
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/**
 * Supabase Storage implementation of `StoragePort` (Feature #398, Task #399 /
 * T4b). It is constructed with the shared `service_role` client: `service_role`
 * bypasses RLS, so the API owns path authorization (the HTTP layer checks the
 * caller's `userId` prefix before calling `removeObject`).
 *
 * Provider errors never cross the port boundary: the full `message`/`code` is
 * logged for operators and the caller receives only a sanitized code.
 */
export class SupabaseStorageAdapter implements StoragePort {
  constructor(private readonly client: SupabaseClient) {}

  async uploadObject(input: {
    path: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<StorageResult<{ path: string }>> {
    try {
      const { data, error } = await this.client.storage.from(BUCKET).upload(input.path, input.bytes, {
        contentType: input.contentType,
        upsert: false
      });

      if (error) {
        return { ok: false, error: this.toPortError(error, "upload") };
      }

      if (data === null || typeof data.path !== "string") {
        return { ok: false, error: { code: "unavailable" } };
      }

      return { ok: true, value: { path: data.path } };
    } catch (cause) {
      this.logUnexpected("upload", cause);
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async removeObject(path: string): Promise<StorageResult<void>> {
    try {
      const { error } = await this.client.storage.from(BUCKET).remove([path]);

      if (error) {
        return { ok: false, error: this.toPortError(error, "remove") };
      }

      // Removing a missing object reports no error; the call is idempotent.
      return { ok: true, value: undefined };
    } catch (cause) {
      this.logUnexpected("remove", cause);
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async downloadObject(path: string): Promise<StorageResult<{ bytes: Uint8Array; contentType: string }>> {
    try {
      const { data, error } = await this.client.storage.from(BUCKET).download(path);

      if (error) {
        return { ok: false, error: this.toPortError(error, "download") };
      }

      // `download` answers a Blob; anything else is a provider contract we do
      // not understand, so it stays `unavailable` rather than surfacing.
      if (data === null || typeof (data as { arrayBuffer?: unknown }).arrayBuffer !== "function") {
        return { ok: false, error: { code: "unavailable" } };
      }

      const bytes = new Uint8Array(await data.arrayBuffer());
      const contentType = typeof data.type === "string" && data.type.length > 0 ? data.type : DEFAULT_CONTENT_TYPE;
      return { ok: true, value: { bytes, contentType } };
    } catch (cause) {
      this.logUnexpected("download", cause);
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private toPortError(
    error: { readonly message: string; readonly statusCode?: string | undefined },
    operation: string
  ): StoragePortError {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseStorageAdapter] ${operation} error`, {
      statusCode: error.statusCode,
      message: error.message
    });

    if (error.statusCode === NOT_FOUND) return { code: "not_found" };
    // Storage answers `400` for a malformed object key, on any operation. The
    // HTTP routes already reject unowned paths before reaching the adapter, so
    // this code only affects callers that inspect the error, never a leak.
    if (error.statusCode === BAD_REQUEST) return { code: "invalid_path" };
    return { code: "unavailable" };
  }

  private logUnexpected(operation: string, cause: unknown): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseStorageAdapter] ${operation} threw`, {
      cause: cause instanceof Error ? cause.name : "unknown"
    });
  }
}

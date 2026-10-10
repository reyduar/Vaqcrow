/**
 * Vendor-free object-storage port (Feature #398, Task #399 / T4b).
 *
 * The application layer knows only this shape; the Supabase Storage specifics
 * live in `infrastructure/adapters/supabase-storage-adapter.ts`. Errors are a
 * sanitized code, never a provider `message`/`details`/`hint`.
 */

export type StorageErrorCode = "not_found" | "invalid_path" | "unavailable";

export interface StoragePortError {
  readonly code: StorageErrorCode;
}

export type StorageResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: StoragePortError };

export interface UploadObjectInput {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface DownloadedObject {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface StoragePort {
  /** Writes `bytes` at `path` with the given content type. Never upserts: a path collision is a failure. */
  uploadObject(input: UploadObjectInput): Promise<StorageResult<{ readonly path: string }>>;

  /** Removes the object at `path`. Removing a missing object is not an error (idempotent). */
  removeObject(path: string): Promise<StorageResult<void>>;

  /**
   * Reads the object at `path` as its raw bytes plus its stored content type —
   * the read half of the storage boundary the content-relevance check needs.
   * The path is server-owned: it must sit under the caller's own `userId/`
   * prefix (see `isOwnedObjectPath`), never a value trusted from a request body.
   * A missing object is `not_found`; a malformed key is `invalid_path`.
   */
  downloadObject(path: string): Promise<StorageResult<DownloadedObject>>;
}

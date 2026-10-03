/**
 * Document/photo upload capability of the PyME onboarding wizard (Feature
 * #398, Task #399 / T4c). Vendor-free and React-free: the HTTP adapter lives
 * in `infrastructure/upload/`.
 *
 * The bytes travel API-mediated (`POST /storage/uploads`), so the browser
 * never talks to Supabase Storage directly and the API keeps the
 * `service_role` credential. Every failure is a sanitized code — never a
 * provider message or a filename echo.
 */

/** The four kinds the API accepts: three mandatory slots plus optional photos. */
export type UploadKind = "sales-declarations" | "cuit" | "articles-of-incorporation" | "photo";

/**
 * Sanitized failure codes. They mirror the API's `{ code }` envelope plus the
 * transport's own `network`; the UI maps each one to its own copy.
 */
export type UploadErrorCode =
  | "unsupported_type"
  | "too_large"
  | "invalid_name"
  | "invalid_kind"
  | "unavailable"
  | "network";

export const UPLOAD_ERROR_CODES: readonly UploadErrorCode[] = Object.freeze([
  "unsupported_type",
  "too_large",
  "invalid_name",
  "invalid_kind",
  "unavailable",
  "network"
]);

/** Descriptor of a stored object, as returned by `POST /storage/uploads`. */
export interface UploadedDocument {
  readonly path: string;
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
}

export type UploadDocumentResult =
  | ({ readonly ok: true } & UploadedDocument)
  | { readonly ok: false; readonly code: UploadErrorCode };

export type RemoveDocumentResult = { readonly ok: true } | { readonly ok: false; readonly code: UploadErrorCode };

export interface UploadDocumentInput {
  readonly kind: UploadKind;
  readonly file: File;
  /** Best-effort transport progress, 0–100. */
  readonly onProgress?: (percent: number) => void;
}

export interface UploadPort {
  /** Uploads one file and resolves with its stored descriptor, or a sanitized code. */
  uploadDocument(input: UploadDocumentInput): Promise<UploadDocumentResult>;
  /** Removes the object at `path`; removing a missing object is a success. */
  removeDocument(path: string): Promise<RemoveDocumentResult>;
}

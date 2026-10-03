/**
 * Pure validation for a PyME onboarding document or photo (Feature #398,
 * Task #399 / T4b).
 *
 * The transport is API-mediated: the browser sends bytes to the API, which
 * validates them here and only then writes to the private `pyme-documents`
 * bucket with `service_role`. Nothing in this module touches Fastify, Supabase
 * or the filesystem — it is a function of its input, so it can be unit-tested
 * directly and reused by any transport.
 *
 * Validation is deliberately byte-first: the declared content type is checked
 * against the allow-list *and* the leading magic bytes are checked
 * independently, so a caller cannot smuggle a disallowed format by lying about
 * the content type. The two must agree.
 */

export const ALLOWED_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

/** 10 MB, matching the bucket's `file_size_limit`. */
export const MAX_UPLOAD_BYTES = 10485760;

/** The three mandatory slots plus up to four optional photos (owner U1/U2). */
export const DOCUMENT_KINDS = [
  "sales-declarations",
  "cuit",
  "articles-of-incorporation",
  "photo"
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export type UploadRejectionCode = "unsupported_type" | "too_large" | "invalid_name" | "invalid_kind";

export interface ValidatedUpload {
  readonly path: string;
  readonly kind: DocumentKind;
  readonly name: string;
  readonly size: number;
  readonly contentType: AllowedContentType;
}

export type ValidateDocumentUploadResult =
  | { readonly ok: true; readonly value: ValidatedUpload }
  | { readonly ok: false; readonly code: UploadRejectionCode };

export interface ValidateDocumentUploadInput {
  readonly userId: string;
  readonly kind: string;
  readonly filename: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
  /** Injected so tests are deterministic; the HTTP layer passes `crypto.randomUUID`. */
  readonly generateId: () => string;
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const EXTENSIONS_BY_TYPE: Readonly<Record<AllowedContentType, readonly string[]>> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"]
};

const MAX_NAME_LENGTH = 80;
const SAFE_EXTENSION = /^[A-Za-z0-9]{1,8}$/;

function isAllowedContentType(value: string): value is AllowedContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.byteLength < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

/** The format the bytes actually are, ignoring whatever the caller declared. */
export function detectContentType(bytes: Uint8Array): AllowedContentType | undefined {
  if (startsWith(bytes, PDF_SIGNATURE)) return "application/pdf";
  if (startsWith(bytes, JPEG_SIGNATURE)) return "image/jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  return undefined;
}

/**
 * Strips path separators and control characters, keeps a safe extension derived
 * from the detected format, and bounds the name. `undefined` means nothing safe
 * survived (for example `"../../"`), which is reported as `invalid_name`.
 */
export function sanitizeFilename(filename: string, contentType: AllowedContentType): string | undefined {
  const basename = filename.split(/[\\/]/).pop() ?? "";
  const withoutControl = Array.from(basename)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 0x1f && code !== 0x7f;
    })
    .join("");
  const lastDot = withoutControl.lastIndexOf(".");
  const rawStem = lastDot > 0 ? withoutControl.slice(0, lastDot) : withoutControl;
  const rawExtension = lastDot > 0 ? withoutControl.slice(lastDot + 1).toLowerCase() : "";

  let stem = rawStem
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  if (stem.length === 0) return undefined;

  const allowedExtensions = EXTENSIONS_BY_TYPE[contentType];
  const extension =
    SAFE_EXTENSION.test(rawExtension) && allowedExtensions.includes(rawExtension)
      ? rawExtension
      : allowedExtensions[0]!;

  const maxStemLength = MAX_NAME_LENGTH - extension.length - 1;
  if (stem.length > maxStemLength) {
    stem = stem.slice(0, maxStemLength).replace(/[.-]+$/g, "");
  }
  if (stem.length === 0) return undefined;

  return `${stem}.${extension}`;
}

/**
 * The single validation entry point. Returns sanitized codes only — never the
 * caller's filename, provider text, or any detail that could echo back.
 */
export function validateDocumentUpload(
  input: ValidateDocumentUploadInput
): ValidateDocumentUploadResult {
  if (!isAllowedContentType(input.contentType)) {
    return { ok: false, code: "unsupported_type" };
  }

  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, code: "too_large" };
  }

  const detected = detectContentType(input.bytes);
  // Checked independently of the declared type: a mismatch is a rejection, and
  // an unrecognized leading signature is a rejection even when declared type is
  // on the allow-list.
  if (detected === undefined || detected !== input.contentType) {
    return { ok: false, code: "unsupported_type" };
  }

  if (!isDocumentKind(input.kind)) {
    return { ok: false, code: "invalid_kind" };
  }

  const name = sanitizeFilename(input.filename, detected);
  if (name === undefined) {
    return { ok: false, code: "invalid_name" };
  }

  return {
    ok: true,
    value: {
      path: `${input.userId}/${input.kind}/${input.generateId()}-${name}`,
      kind: input.kind,
      name,
      size: input.bytes.byteLength,
      contentType: detected
    }
  };
}

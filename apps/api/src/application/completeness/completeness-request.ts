import {
  COMPLETENESS_DOCUMENT_KINDS,
  type CompletenessCheckInput,
  type CompletenessDocument,
  type CompletenessDocumentKind,
  type CompletenessSalesMonth
} from "./completeness-check.js";

/**
 * Strict wire-shape validation for `POST /completeness-check` (Feature #402,
 * Task #403 / T1a).
 *
 * Pure, vendor-free and separate from the rules: it decides whether the body is
 * a well-formed `CompletenessCheckInput`, never whether the application is
 * complete. Unknown keys are refused rather than ignored, so a caller cannot
 * smuggle a field (for example an owner or a pre-computed result) past the
 * boundary. Missing documents are *not* a validation error — an empty document
 * list is a legitimate "nothing uploaded yet" state that the rules report as
 * missing-document gaps.
 */

export interface CompletenessFieldError {
  readonly field: string;
  readonly code: string;
}

export type ValidateCompletenessCheckInputResult =
  | { readonly ok: true; readonly value: CompletenessCheckInput }
  | { readonly ok: false; readonly fieldErrors: readonly CompletenessFieldError[] };

const INPUT_KEYS: ReadonlySet<string> = new Set(["documents", "photoCount", "salesMonths"]);
const DOCUMENT_KEYS: ReadonlySet<string> = new Set(["kind", "present"]);
const SALES_MONTH_KEYS: ReadonlySet<string> = new Set(["month", "valueArs"]);
/** The wizard renders exactly eight months; more is malformed, fewer is allowed. */
const MAX_SALES_MONTHS = 8;
const MAX_MONTH_LENGTH = 32;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  const actual = Object.keys(record);
  return actual.length === keys.size && actual.every((key) => keys.has(key));
}

function isDocumentKind(value: unknown): value is CompletenessDocumentKind {
  return typeof value === "string" && (COMPLETENESS_DOCUMENT_KINDS as readonly string[]).includes(value);
}

function validateDocuments(body: Record<string, unknown>, errors: CompletenessFieldError[]): readonly CompletenessDocument[] | undefined {
  const raw = body["documents"];
  if (!Array.isArray(raw)) {
    errors.push({ field: "documents", code: "invalid" });
    return undefined;
  }

  const documents: CompletenessDocument[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isPlainRecord(item) || !hasExactKeys(item, DOCUMENT_KEYS)) {
      errors.push({ field: "documents", code: "invalid" });
      return undefined;
    }
    if (!isDocumentKind(item["kind"])) {
      errors.push({ field: "documents", code: "invalid_kind" });
      return undefined;
    }
    if (typeof item["present"] !== "boolean") {
      errors.push({ field: "documents", code: "invalid" });
      return undefined;
    }
    if (seen.has(item["kind"])) {
      errors.push({ field: "documents", code: "invalid" });
      return undefined;
    }
    seen.add(item["kind"]);
    documents.push({ kind: item["kind"], present: item["present"] });
  }
  return documents;
}

function validatePhotoCount(body: Record<string, unknown>, errors: CompletenessFieldError[]): number | undefined {
  const raw = body["photoCount"];
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
    errors.push({ field: "photoCount", code: "invalid" });
    return undefined;
  }
  return raw;
}

function validateSalesMonths(
  body: Record<string, unknown>,
  errors: CompletenessFieldError[]
): readonly CompletenessSalesMonth[] | undefined {
  const raw = body["salesMonths"];
  if (!Array.isArray(raw) || raw.length > MAX_SALES_MONTHS) {
    errors.push({ field: "salesMonths", code: "invalid" });
    return undefined;
  }

  const months: CompletenessSalesMonth[] = [];
  for (const item of raw) {
    if (!isPlainRecord(item) || !hasExactKeys(item, SALES_MONTH_KEYS)) {
      errors.push({ field: "salesMonths", code: "invalid" });
      return undefined;
    }
    const month = item["month"];
    const value = item["valueArs"];
    const monthOk =
      typeof month === "string" && month.trim().length > 0 && month.trim().length <= MAX_MONTH_LENGTH;
    const valueOk = value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
    if (!monthOk || !valueOk) {
      errors.push({ field: "salesMonths", code: "invalid" });
      return undefined;
    }
    months.push({ month: (month as string).trim(), valueArs: value as number | null });
  }
  return months;
}

export function validateCompletenessCheckInput(body: unknown): ValidateCompletenessCheckInputResult {
  if (!isPlainRecord(body)) {
    return { ok: false, fieldErrors: [{ field: "body", code: "invalid" }] };
  }

  if (Object.keys(body).some((key) => !INPUT_KEYS.has(key))) {
    return { ok: false, fieldErrors: [{ field: "body", code: "invalid" }] };
  }

  const errors: CompletenessFieldError[] = [];
  for (const key of ["documents", "photoCount", "salesMonths"] as const) {
    if (!Object.hasOwn(body, key)) {
      errors.push({ field: key, code: "required" });
    }
  }

  const documents = Object.hasOwn(body, "documents") ? validateDocuments(body, errors) : undefined;
  const photoCount = Object.hasOwn(body, "photoCount") ? validatePhotoCount(body, errors) : undefined;
  const salesMonths = Object.hasOwn(body, "salesMonths") ? validateSalesMonths(body, errors) : undefined;

  if (errors.length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  return {
    ok: true,
    value: {
      documents: documents as readonly CompletenessDocument[],
      photoCount: photoCount as number,
      salesMonths: salesMonths as readonly CompletenessSalesMonth[]
    }
  };
}

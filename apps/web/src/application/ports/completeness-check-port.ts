/**
 * The application completeness check of the onboarding wizard's step 3
 * (Feature #402, Task #403 / T1c). Vendor-free and React-free: the HTTP
 * adapter lives in `infrastructure/completeness/`.
 *
 * The check is advisory (owner decision, 2026-10-05): it reports the declared
 * data the wizard already collected — the three mandatory documents, the photo
 * count and the eight-month sales series — as structured findings. An
 * incomplete result **warns**, it never blocks: the human reviewer in step 4
 * decides. The AI never approves, rejects, calculates an obligation or moves
 * funds.
 *
 * Every failure is a sanitized code in the API's own vocabulary plus the
 * transport's `network`; provider messages never cross this boundary.
 */

/** The three mandatory document slots, mirroring the upload vocabulary. */
export type CompletenessDocumentKind = "sales-declarations" | "cuit" | "articles-of-incorporation";

export interface CompletenessDocumentInput {
  readonly kind: CompletenessDocumentKind;
  readonly present: boolean;
}

export interface CompletenessMonthInput {
  readonly month: string;
  /** Whole ARS; `null` marks a declared-but-missing month (never `0`). */
  readonly valueArs: number | null;
}

/** Exactly the API's `POST /completeness-check` body. */
export interface CompletenessCheckInput {
  readonly documents: readonly CompletenessDocumentInput[];
  readonly photoCount: number;
  readonly salesMonths: readonly CompletenessMonthInput[];
}

/** The finding codes the API emits; anything else is dropped as malformed. */
export type CompletenessFindingCode =
  | "missing_document"
  | "insufficient_photos"
  | "missing_sales_month"
  | "sales_anomaly"
  | "content_irrelevant"
  | "content_unverified";

/** `gap` is a completeness shortfall; `warning` is informational. */
export type CompletenessFindingSeverity = "gap" | "warning";

export interface CompletenessFinding {
  readonly code: CompletenessFindingCode;
  readonly severity: CompletenessFindingSeverity;
  /** Sanitized Spanish copy naming the finding; no PII, no claims. */
  readonly detail: string;
}

export interface CompletenessResult {
  readonly complete: boolean;
  readonly findings: readonly CompletenessFinding[];
}

/**
 * Sanitized failure codes. They mirror the API's `{ code }` / `{ errors }`
 * envelopes plus the transport's own `network`; the UI maps each one to copy.
 */
export type CompletenessErrorCode = "invalid_request" | "unavailable" | "network";

export const COMPLETENESS_ERROR_CODES: readonly CompletenessErrorCode[] = Object.freeze([
  "invalid_request",
  "unavailable",
  "network"
]);

export type CompletenessCheckResult =
  | { readonly ok: true; readonly result: CompletenessResult }
  | { readonly ok: false; readonly code: CompletenessErrorCode };

export interface CompletenessCheckPort {
  check(input: CompletenessCheckInput): Promise<CompletenessCheckResult>;
}

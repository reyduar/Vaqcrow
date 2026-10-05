import type { DocumentKind } from "../storage/document-upload.js";

/**
 * The application completeness check (Feature #402, Task #403 / T1a).
 *
 * Scoped by the owner on 2026-10-05 to **declared data and document presence**,
 * not document content: the wizard already collects the three mandatory
 * documents, up to four photos and the eight-month sales series, so the check
 * is a pure function of that metadata. Vision (reading the bytes to detect an
 * irrelevant document) is deferred; nothing here touches storage, the model or
 * the network.
 *
 * The result is advisory: gaps *warn*, they never block. The PyME sees the
 * findings in wizard step 3 and the human reviewer decides.
 *
 * The document kinds are the mandatory subset of the upload kinds
 * (`../storage/document-upload.js`), so the wire vocabularies cannot drift.
 */

export type CompletenessDocumentKind = Exclude<DocumentKind, "photo">;

/** The three mandatory slots, in the order the findings are reported. */
export const COMPLETENESS_DOCUMENT_KINDS: readonly CompletenessDocumentKind[] = Object.freeze([
  "sales-declarations",
  "cuit",
  "articles-of-incorporation"
]);

/** The Spanish label each missing document is named by, interface voice. */
export const COMPLETENESS_DOCUMENT_LABELS: Readonly<Record<CompletenessDocumentKind, string>> =
  Object.freeze({
    "sales-declarations": "Declaraciones de ventas",
    cuit: "Constancia de CUIT",
    "articles-of-incorporation": "Estatuto"
  });

export interface CompletenessDocument {
  readonly kind: CompletenessDocumentKind;
  readonly present: boolean;
}

export interface CompletenessSalesMonth {
  readonly month: string;
  readonly valueArs: number | null;
}

export interface CompletenessCheckInput {
  readonly documents: readonly CompletenessDocument[];
  readonly photoCount: number;
  readonly salesMonths: readonly CompletenessSalesMonth[];
}

export type CompletenessFindingCode =
  | "missing_document"
  | "insufficient_photos"
  | "missing_sales_month"
  | "sales_anomaly";

/**
 * `gap` is a blocking-for-completeness finding (the human still decides whether
 * to proceed); `warning` is informational and never flips `complete` to false.
 */
export type CompletenessFindingSeverity = "gap" | "warning";

export interface CompletenessFinding {
  readonly code: CompletenessFindingCode;
  readonly severity: CompletenessFindingSeverity;
  /** Sanitized Spanish copy naming the finding; no PII, no claims. */
  readonly detail: string;
}

export interface CompletenessCheckResult {
  readonly complete: boolean;
  readonly findings: readonly CompletenessFinding[];
}

const PHOTO_MIN = 1;
const PHOTO_MAX = 4;
const SALES_MONTHS_MIN = 6;
/** Template line 335: `> average * 1.5`, mirrored from the wizard's `salesAnomaly`. */
const ANOMALY_FACTOR = 1.5;
const MAX_MONTH_LENGTH = 32;

/**
 * The month label crosses into user-facing copy, so it is bounded to letters,
 * numbers, spaces and hyphens before interpolation. The route validator already
 * bounds it; this keeps the pure function total for any caller.
 */
function safeMonthLabel(month: string): string {
  const cleaned = String(month)
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .trim()
    .slice(0, MAX_MONTH_LENGTH);
  return cleaned.length > 0 ? cleaned : "el mes declarado";
}

function isValued(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * A declared month with no value (`null`, or not a finite number) is a gap, one
 * finding per month so the detail can name it — the template's admin
 * notification reads "La IA marcó un faltante (abril)". `0` is a value, not a
 * missing month. When the caller declares fewer than six months in total the
 * shortfall cannot be attributed to named months, so one aggregate gap stands
 * in for the remainder.
 */
function salesFindings(salesMonths: readonly CompletenessSalesMonth[]): CompletenessFinding[] {
  const findings: CompletenessFinding[] = [];
  const missingMonths = salesMonths.filter((month) => !isValued(month.valueArs));
  const valuedCount = salesMonths.length - missingMonths.length;

  if (valuedCount < SALES_MONTHS_MIN) {
    for (const month of missingMonths) {
      findings.push({
        code: "missing_sales_month",
        severity: "gap",
        detail: `Falta declarar las ventas de ${safeMonthLabel(month.month)}.`
      });
    }
    if (SALES_MONTHS_MIN - valuedCount - missingMonths.length > 0) {
      findings.push({
        code: "missing_sales_month",
        severity: "gap",
        detail: `Cargá al menos ${SALES_MONTHS_MIN} de 8 meses de ventas.`
      });
    }
  }

  // Mirrors `salesAnomaly` in the wizard: a non-null month is anomalous when it
  // is more than 1.5x the average of the *positive* valued months.
  const positives = salesMonths
    .map((month) => month.valueArs)
    .filter((value): value is number => isValued(value) && value > 0);
  const average = positives.length > 0 ? positives.reduce((sum, value) => sum + value, 0) / positives.length : 0;

  if (average > 0) {
    for (const month of salesMonths) {
      if (isValued(month.valueArs) && month.valueArs > average * ANOMALY_FACTOR) {
        findings.push({
          code: "sales_anomaly",
          severity: "warning",
          detail: `Las ventas de ${safeMonthLabel(month.month)} superan ampliamente el promedio declarado.`
        });
      }
    }
  }

  return findings;
}

/**
 * The completeness of a PyME application, as structured findings. Deterministic
 * and side-effect free: no clock, no randomness, no I/O. `complete` is true
 * exactly when no finding is a `gap`.
 */
export function checkCompleteness(input: CompletenessCheckInput): CompletenessCheckResult {
  const findings: CompletenessFinding[] = [];

  const presentKinds = new Set(
    input.documents.filter((document) => document.present).map((document) => document.kind)
  );
  for (const kind of COMPLETENESS_DOCUMENT_KINDS) {
    if (!presentKinds.has(kind)) {
      findings.push({
        code: "missing_document",
        severity: "gap",
        detail: `Falta un documento obligatorio: ${COMPLETENESS_DOCUMENT_LABELS[kind]}.`
      });
    }
  }

  if (input.photoCount < PHOTO_MIN) {
    findings.push({
      code: "insufficient_photos",
      severity: "gap",
      detail: "Agregá al menos una foto de tu negocio."
    });
  } else if (input.photoCount > PHOTO_MAX) {
    findings.push({
      code: "insufficient_photos",
      severity: "warning",
      detail: `Subiste ${input.photoCount} fotos: el máximo sugerido es ${PHOTO_MAX}.`
    });
  }

  findings.push(...salesFindings(input.salesMonths));

  return { complete: !findings.some((finding) => finding.severity === "gap"), findings };
}

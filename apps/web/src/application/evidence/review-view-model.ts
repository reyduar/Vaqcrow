/**
 * View-model types for the SME request form and the evidence review panel
 * (Task #56 / T4). Plain data only: no React, no contracts at runtime. The
 * page layer (T5) maps backend/contract data into these shapes; presentation
 * renders them without interpreting or completing anything.
 */

/** Raw browser form state. Strings on purpose: parsing and business validation stay with the backend. */
export interface SmeRequestFormValues {
  readonly declaredTotalArs: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}

export type SmeRequestFormField = keyof SmeRequestFormValues;

/** Sanitized error supplied from outside; rendered verbatim. */
export interface SmeRequestSubmitError {
  readonly message?: string;
  readonly fieldErrors?: Readonly<Partial<Record<SmeRequestFormField, string>>>;
}

export type ReviewItemKind = "missing" | "anomalous" | "contradictory";

/** Already-resolved evidence reference; unresolved refs never carry invented data. */
export type ReviewEvidence =
  | { readonly status: "resolved"; readonly ref: string; readonly provenance: string }
  | { readonly status: "unresolved"; readonly ref: string };

export interface EvidenceReviewItem {
  readonly kind: ReviewItemKind;
  /** Human-readable period label, e.g. "Abril 2026"; omitted for request-level findings. */
  readonly periodLabel?: string;
  readonly evidence?: ReviewEvidence;
  /** Contradictory findings only: pre-formatted amounts exactly as supplied by the caller. */
  readonly declaredTotal?: string;
  readonly reportedTotal?: string;
}

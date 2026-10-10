/**
 * View-model types for the SME request submission (Task #56 / T4), used by the
 * PyME onboarding wizard's review step. Plain data only: no React, no
 * contracts at runtime.
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

import type { AssessmentView } from "@/application/assessment/assessment-view";

/**
 * What the backend did with one assessment attempt for an application.
 *
 * - `recorded`: the assessment was persisted and the application moved to human
 *   review. `view` is the persisted record.
 * - `manual_review`: the AI could not produce an admissible assessment; the
 *   application went to human review WITHOUT one. `failureCode` is the closed
 *   sanitized code, never provider text.
 * - `sales_evidence_missing`: the request has no sales series, so nothing was
 *   evaluated and nothing changed.
 *
 * Every other backend failure (unknown application, state or attempt conflict,
 * outage) is thrown as an `HttpClientError` whose `errorCode` carries the
 * backend's own code.
 */
export type AssessmentOutcome =
  | { readonly kind: "recorded"; readonly view: AssessmentView }
  | { readonly kind: "manual_review"; readonly failureCode: string }
  | { readonly kind: "sales_evidence_missing" };

/**
 * Port for the application-scoped assessment backend.
 *
 * `assess` runs `POST /application-reviews/:id/assessments`; the evidence is
 * derived server-side from the persisted request, so the caller only supplies
 * the per-attempt idempotency key. `load` reads `GET .../assessment` and
 * resolves `null` only for the backend's "no assessment recorded" (404).
 * Implementations validate what they return and throw on anything else.
 */
export interface AssessmentGateway {
  assess(applicationId: string, handoffId: string): Promise<AssessmentOutcome>;
  load(applicationId: string): Promise<AssessmentView | null>;
}

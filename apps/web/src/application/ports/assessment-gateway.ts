import type { ReviewFinding, SalesPeriodContract } from "@vaqcrow/contracts";
import type { AssessmentView } from "@/application/assessment/assessment-view";

/**
 * The evidence a caller asks to have assessed. It is the same vocabulary the
 * API validates on the way in, so "only the supplied evidence is sent" holds on
 * both sides of the wire.
 */
export interface AssessmentEvidence {
  readonly periods: readonly SalesPeriodContract[];
  readonly findings: readonly ReviewFinding[];
}

/**
 * Port for the assessment backend (`POST /assessments`).
 *
 * Implementations return a view model validated against the shape the screen
 * reads, and throw on anything else. HTTP failures surface as `HttpClientError`,
 * whose `errorCode` carries the backend's own code — `timeout`,
 * `provider_unavailable`, `invalid_output`, `unknown_evidence_reference` — so
 * `application/` can classify a failure without importing infrastructure.
 *
 * Deciding what a failure *means* for the operator is not this port's job:
 * routing a failed assessment to manual review belongs to Feature #22.
 */
export interface AssessmentGateway {
  assess(evidence: AssessmentEvidence): Promise<AssessmentView>;
}

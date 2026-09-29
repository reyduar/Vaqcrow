import type { ApplicationManualReviewContext } from "@vaqcrow/contracts";

/**
 * Port for the application-scoped manual-review read
 * (`GET /application-reviews/:applicationId/manual-review`).
 *
 * `load` resolves to the persisted, contract-validated context, or `null` when
 * the backend truthfully reports that no handoff exists for the application
 * (`404 not_found`). Any other failure rejects, so `application/` can tell
 * "there is no context" apart from "the context could not be requested".
 */
export interface ManualReviewGateway {
  load(applicationId: string): Promise<ApplicationManualReviewContext | null>;
}

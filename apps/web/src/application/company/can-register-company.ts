import type { ApplicationReviewState } from "@vaqcrow/contracts";

/**
 * Whether `/company` may still offer «Registrar mi PyME» (Feature #530, S1–S3).
 *
 * The button is only for «Sin enviar»: no application at all (`null`), a state
 * that has not been read yet (`undefined` — a missing read is never a service
 * failure, #480), or an application still in `draft`. Every real
 * post-submission state hides it: in review (`awaiting_assessment` /
 * `human_review`, S1), approved (`approved`, S2), `changes_requested` and
 * `rejected` (S3), where the PyME instead reviews what it sent.
 *
 * React-free so the rule and its honesty are unit-tested without rendering.
 */
export function canRegisterCompany(state: ApplicationReviewState | null | undefined): boolean {
  return state === undefined || state === null || state === "draft";
}

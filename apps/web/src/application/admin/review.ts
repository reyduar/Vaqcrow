import type { ApplicationReviewState } from "@vaqcrow/contracts";
import type { AdminReviewCompany } from "@/application/ports/admin-review-port";
import {
  formatQueueUpdatedAt,
  MISSING_BUSINESS_LABEL,
  QUEUE_STATE_COPY,
  queueDisplayState,
  type QueueStateCopy
} from "./queue";

/**
 * Pure model of the admin review header (`Vaqcrow Admin.dc.html`, view
 * `review`), React-free. Copy is verbatim from the template: «Revisión:
 * {name}» and «{sector} · {id} · enviada el dd/mm/aaaa». The API does not
 * expose a submission date yet, so the date part is only appended when one is
 * known — never invented. The state badge reuses the queue's `ST` mapping.
 */

export const ADMIN_PYMES_PATH = "/admin/pymes";

/** The English console route for one application's review. */
export function adminReviewPath(applicationId: string): string {
  return `${ADMIN_PYMES_PATH}/${encodeURIComponent(applicationId)}`;
}

export interface ReviewHeaderInput {
  readonly applicationId: string;
  readonly state: ApplicationReviewState;
  readonly company: Pick<AdminReviewCompany, "name" | "sector"> | null;
  /** ISO timestamp of the submission, when the API provides one. */
  readonly submittedAt?: string;
}

export interface ReviewHeader {
  readonly title: string;
  readonly subline: string;
  readonly state: QueueStateCopy;
}

function presentOrMissing(value: string | undefined): string {
  return value === undefined || value.trim() === "" ? MISSING_BUSINESS_LABEL : value;
}

export function reviewHeaderFor(input: ReviewHeaderInput): ReviewHeader {
  const name = presentOrMissing(input.company?.name);
  const sector = presentOrMissing(input.company?.sector);
  const parts = [sector, input.applicationId];
  if (input.submittedAt !== undefined) parts.push(`enviada el ${formatQueueUpdatedAt(input.submittedAt)}`);
  return {
    title: `Revisión: ${name}`,
    subline: parts.join(" · "),
    state: QUEUE_STATE_COPY[queueDisplayState(input.state)]
  };
}

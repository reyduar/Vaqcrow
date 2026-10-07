import type {
  AdminDocumentFileResult,
  AdminReviewPort,
  AdminReviewResult,
  RecordDecisionResult,
  SetDocumentVerdictResult
} from "@/application/ports/admin-review-port";

/**
 * Null-object admin review used when no backend base URL is configured: every
 * read and write is the sanitized `unavailable`, so the review shows its error
 * state instead of an invented application, and no verdict or decision is
 * ever claimed.
 */
export const UNAVAILABLE_ADMIN_REVIEW_PORT: AdminReviewPort = Object.freeze({
  async getContext(): Promise<AdminReviewResult> {
    return { ok: false, code: "unavailable" };
  },
  async setDocumentVerdict(): Promise<SetDocumentVerdictResult> {
    return { ok: false, code: "unavailable" };
  },
  async downloadDocument(): Promise<AdminDocumentFileResult> {
    return { ok: false, code: "unavailable" };
  },
  async recordDecision(): Promise<RecordDecisionResult> {
    return { ok: false, code: "unavailable" };
  }
});

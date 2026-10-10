import type {
  AdminDocumentFileResult,
  AdminEvidencePort,
  AdminReviewPort,
  AdminReviewResult,
  DeployResult,
  GetDeploymentResult,
  GetEvidenceResult,
  RecordDecisionResult,
  SetDocumentVerdictResult
} from "@/application/ports/admin-review-port";

/**
 * Null-object admin review used when no backend base URL is configured: every
 * read and write is the sanitized `unavailable`, so the review shows its error
 * state instead of an invented application, and no verdict, decision,
 * deployment or Testnet evidence is ever claimed.
 */
export const UNAVAILABLE_ADMIN_REVIEW_PORT: AdminReviewPort & AdminEvidencePort = Object.freeze({
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
  },
  async getDeployment(): Promise<GetDeploymentResult> {
    return { ok: false, code: "unavailable" };
  },
  async deploy(): Promise<DeployResult> {
    return { ok: false, code: "unavailable" };
  },
  async getEvidence(): Promise<GetEvidenceResult> {
    return { ok: false, code: "unavailable" };
  }
});

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
 * Null-object admin review used when no backend base URL is configured (#480).
 *
 * The two **reads that gate rendering** — `getContext` (the review) and
 * `getEvidence` (the evidence view) — answer `not_configured`: the honest "no
 * API wired up", which the view renders as a calm notice, never as a service
 * failure.
 *
 * The writes and the deploy keep the sanitized `unavailable`: their result-code
 * contracts do not carry the local `not_configured` code, and they are
 * unreachable in this state anyway — the review only offers them once a context
 * has loaded, which it never does without a backend. No verdict, decision,
 * deployment or Testnet evidence is ever claimed.
 */
export const UNAVAILABLE_ADMIN_REVIEW_PORT: AdminReviewPort & AdminEvidencePort = Object.freeze({
  async getContext(): Promise<AdminReviewResult> {
    return { ok: false, code: "not_configured" };
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
    return { ok: false, code: "not_configured" };
  }
});

import type {
  ApplicationAssessmentRead,
  ApplicationReviewState,
  DocumentVerdictRecord,
  DocumentVerdictValue,
  HumanDecisionOutcome,
  HumanDecisionRecord,
  SmeRequest
} from "@vaqcrow/contracts";

/**
 * The admin review capability (Feature #410 / U2). Vendor-free and React-free;
 * the HTTP adapter lives in `infrastructure/admin/`.
 *
 * It mirrors `GET /application-reviews/:applicationId/context` (ADMIN-only):
 * the application's review state, its SME request, the owner's company (or
 * `null` when none was registered), the uploaded document descriptors, the
 * per-document verdicts (U1), the advisory assessment and the latest human
 * decision. The owner's user id never crosses this boundary: the console has
 * no use for it.
 */

/** The owner's company as the API returns it; absent fields are never invented. */
export interface AdminReviewCompany {
  readonly name: string;
  readonly cuit: string;
  readonly sector: string;
  readonly city: string;
  readonly description: string;
  /** The financing goal in whole ARS. */
  readonly goalArs: number;
  /** The revenue-share percentage. */
  readonly revenueShare: number;
  /** ISO 8601 deadline the PyME declared, or `null` when none. */
  readonly deadline: string | null;
}

/** One uploaded document; `objectPath` is the private viewer key, never a public URL. */
export interface AdminReviewDocument {
  readonly documentId: string;
  readonly kind: string;
  readonly objectPath: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly contentType: string;
  readonly createdAt: string;
}

export interface AdminReviewContext {
  readonly applicationId: string;
  readonly state: ApplicationReviewState;
  readonly smeRequest: SmeRequest;
  readonly company: AdminReviewCompany | null;
  readonly documents: readonly AdminReviewDocument[];
  readonly documentVerdicts: readonly DocumentVerdictRecord[];
  readonly assessment: ApplicationAssessmentRead | null;
  readonly latestHumanDecision: HumanDecisionRecord | null;
}

/**
 * Sanitized failure codes: `not_found` (404, or an id the API would never
 * accept), `unavailable` (any other non-200 or a malformed body) and the
 * transport's `network`.
 */
export type AdminReviewErrorCode = "not_found" | "unavailable" | "network";

export type AdminReviewResult =
  | { readonly ok: true; readonly context: AdminReviewContext }
  | { readonly ok: false; readonly code: AdminReviewErrorCode };

/**
 * Outcome of `PUT /application-reviews/:applicationId/documents/:documentId/verdict`
 * (U3). `applied: false` is an idempotent replay of the current verdict. A
 * `state_conflict` carries the review's actual state (the review only takes
 * verdicts in `awaiting_assessment`/`human_review`); `not_found` covers an
 * unknown application or a document outside it.
 */
export type SetDocumentVerdictResult =
  | { readonly ok: true; readonly applied: boolean; readonly verdict: DocumentVerdictRecord }
  | { readonly ok: false; readonly code: "state_conflict"; readonly actualState: ApplicationReviewState }
  | { readonly ok: false; readonly code: "not_found" | "unavailable" | "network" };

export type SetDocumentVerdictFailure = Extract<SetDocumentVerdictResult, { ok: false }>;

/**
 * Bytes of one private document, read through the ADMIN-only
 * `GET /storage/uploads?path=` (D1). Any non-200 is the sanitized
 * `unavailable`: the console never distinguishes why a file could not be read.
 */
export type AdminDocumentFileResult =
  | { readonly ok: true; readonly file: Blob }
  | { readonly ok: false; readonly code: "unavailable" | "network" };

/**
 * Body of `POST /application-reviews/:applicationId/decisions` (U5), exactly
 * these four keys: the actor is the verified admin, never sent (#370).
 * `decisionId` is a client UUID v4 reused on a retry of the same submission so
 * the API can answer an idempotent replay. `approvedLimitArs` is a positive
 * integer for `approved` and `null` otherwise.
 */
export interface RecordDecisionRequest {
  readonly decisionId: string;
  readonly outcome: HumanDecisionOutcome;
  readonly reason: string;
  readonly approvedLimitArs: number | null;
}

/**
 * Outcome of the decision write. `applied: false` is a replay (200) of a
 * decision already recorded with the same id and payload. `state_conflict`
 * carries the review's actual state; `idempotency_conflict` means the id was
 * used with another payload; `invalid_request` is a 400.
 */
export type RecordDecisionResult =
  | { readonly ok: true; readonly applied: boolean; readonly decision: HumanDecisionRecord }
  | { readonly ok: false; readonly code: "state_conflict"; readonly actualState: ApplicationReviewState }
  | {
      readonly ok: false;
      readonly code: "idempotency_conflict" | "invalid_request" | "not_found" | "unavailable" | "network";
    };

export type RecordDecisionFailure = Extract<RecordDecisionResult, { ok: false }>;

/** The persisted vault-deployment lifecycle of an approved application (T5b / D3). */
export type CampaignDeploymentState = "pending" | "deploying" | "confirmed" | "failed";

/**
 * Read-only projection of `GET /application-reviews/:applicationId/deployment`.
 * `lastError` is the API's sanitized code (never provider text) and
 * `campaignId` only exists once the deployment is confirmed; both are `null`
 * when the API omits them. `retryable` (U8) is decided by the server: the last
 * attempt failed, or a `deploying` attempt was abandoned past its threshold.
 */
export interface AdminDeployment {
  readonly applicationId: string;
  readonly state: CampaignDeploymentState;
  readonly attempts: number;
  readonly campaignId: string | null;
  readonly lastError: string | null;
  readonly retryable: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** `not_found` is a 404: no deployment has been recorded for the application yet. */
export type GetDeploymentResult =
  | { readonly ok: true; readonly deployment: AdminDeployment }
  | { readonly ok: false; readonly code: "not_found" | "unavailable" | "network" };

/**
 * Refusals of `POST /application-reviews/:applicationId/deployment` (deploy or
 * retry): 404 `application_not_found`, 409 `application_not_approved`, 409
 * `deployment_in_progress` (a recent attempt still owns the row, U8), the
 * 422 preconditions, the 503 `rate_unavailable`/`unavailable`, and the
 * transport's `network`.
 */
export type DeployFailureCode =
  | "application_not_found"
  | "application_not_approved"
  | "deployment_in_progress"
  | "owner_unresolved"
  | "terms_unavailable"
  | "wallet_required"
  | "goal_limit_exceeded"
  | "rate_unavailable"
  | "unavailable"
  | "network";

export type DeployResult =
  | { readonly ok: true; readonly deployment: AdminDeployment }
  | { readonly ok: false; readonly code: DeployFailureCode };

export interface AdminReviewPort {
  getContext(applicationId: string): Promise<AdminReviewResult>;
  setDocumentVerdict(
    applicationId: string,
    documentId: string,
    verdict: DocumentVerdictValue
  ): Promise<SetDocumentVerdictResult>;
  downloadDocument(objectPath: string): Promise<AdminDocumentFileResult>;
  recordDecision(applicationId: string, request: RecordDecisionRequest): Promise<RecordDecisionResult>;
  getDeployment(applicationId: string): Promise<GetDeploymentResult>;
  deploy(applicationId: string): Promise<DeployResult>;
}

import type { z } from "zod";
import {
  acceptOperatorInvitationCommandSchema,
  adminApplicationEvidenceSchema,
  adminUsersPageSchema,
  applicationAssessmentOutcomeSchema,
  applicationAssessmentReadSchema,
  applicationManualReviewContextSchema,
  assistantAnswerSchema,
  assistantQuestionCommandSchema,
  auditLogPageSchema,
  blogPostListSchema,
  blogPostSchema,
  campaignSnapshotSchema,
  changeUserRoleCommandSchema,
  contractInvocationSchema,
  contractInvocationSubmissionSchema,
  contractInvocationTransactionStatusSchema,
  declaredSalesRequestSchema,
  documentVerdictCommandSchema,
  favoriteCampaignListSchema,
  favoriteCampaignResultSchema,
  fundingIntentSnapshotSchema,
  humanDecisionCommandSchema,
  humanDecisionRecordSchema,
  inviteOperatorCommandSchema,
  inviteOperatorResultSchema,
  investorKycSchema,
  investorReportSchema,
  marketplaceCampaignListSchema,
  myApplicationReadSchema,
  myCampaignsSchema,
  myDocumentsReadSchema,
  openCampaignCommandSchema,
  portfolioSummarySchema,
  prepareContractInvocationCommandSchema,
  prepareFundingIntentCommandSchema,
  prepareRevenueShareDistributionCommandSchema,
  preparedFundingIntentSchema,
  preparedRevenueShareDistributionSchema,
  reportSalesByPymeSchema,
  revenueShareDistributionSnapshotSchema,
  setChatAccessCommandSchema,
  setChatAccessResultSchema,
  setUserActiveCommandSchema,
  smeRequestReadSchema,
  smeRequestSchema,
  smeRequestSubmissionSchema,
  submitContractInvocationCommandSchema,
  submitFundingIntentCommandSchema,
  submitRevenueShareDistributionCommandSchema,
  walletFailureEventSchema,
  campaignDetailSchema
} from "@vaqcrow/contracts";

/**
 * Per-route documentation metadata, keyed by the **exact** authorization-table
 * key (`METHOD /fastify-pattern` in `route-policy.ts`). `build-openapi.ts` walks
 * `ROUTE_POLICY_KEYS` and reads this map, so:
 *
 * - a route with no entry here makes the drift test fail (nothing undocumented), and
 * - an entry here with no route key also fails it (nothing invented).
 *
 * Request and response bodies reference the shared Zod contracts by import, so
 * Zod v4's `toJSONSchema` converts the real shapes and a contract change is
 * caught by the test rather than silently diverging. Where a handler validates
 * or shapes a body **inline** (no shared contract), the operation documents the
 * body as a free object with a note instead of inventing a schema.
 */
export interface OperationSpec {
  readonly tag: string;
  readonly summary: string;
  /** Extra prose for the operation description (trust notes, demo limits). */
  readonly description?: string;
  readonly request?: {
    readonly contentType: string;
    readonly schema?: z.ZodType;
    readonly description?: string;
  };
  /** Success responses by HTTP status. */
  readonly success: Readonly<Record<number, { readonly description: string; readonly schema?: z.ZodType }>>;
  /** Error statuses this operation can return (mapped to the shared envelope). */
  readonly errors?: readonly number[];
  /** A non-JSON response (bytes): sets the response content type instead of JSON. */
  readonly bytes?: string;
}

const AUTH: readonly number[] = [401, 503];
const AUTH_READ: readonly number[] = [401, 400, 503];
const OWNED_READ: readonly number[] = [401, 400, 404, 503];
const ADMIN_DETAIL: readonly number[] = [400, 404, 503];
const CONDITIONAL: readonly number[] = [400, 404, 409, 422, 503];

const INLINE_BODY = (description: string): NonNullable<OperationSpec["request"]> => ({
  contentType: "application/json",
  description
});

export const ROUTE_OPERATIONS: Readonly<Record<string, OperationSpec>> = {
  "GET /health": {
    tag: "Health",
    summary: "Liveness and dependency status",
    success: { 200: { description: "Always 200; `dependencies` reflects optional services and may be degraded." } },
    errors: [500]
  },
  "POST /telemetry/wallet-failures": {
    tag: "Telemetry",
    summary: "Report a wallet-failure classification (beacon)",
    description: "AUTHENTICATED. The web reports a wallet classification it alone can observe; the body is a closed vocabulary (operation + outcome).",
    request: { contentType: "application/json", schema: walletFailureEventSchema },
    success: { 202: { description: "Accepted for logging." } },
    errors: [400, 401, 503]
  },

  // ---- Marketplace ---------------------------------------------------------
  "GET /marketplace/campaigns": {
    tag: "Marketplace",
    summary: "List published campaigns",
    description: "PUBLIC. One unpaginated list of confirmed, open campaigns. Short-lived cache.",
    success: { 200: { description: "The published campaigns.", schema: marketplaceCampaignListSchema } },
    errors: [503]
  },
  "GET /marketplace/campaigns/:campaignId/image": {
    tag: "Marketplace",
    summary: "Proxy a published campaign's photo",
    description: "PUBLIC. Streams bytes from a private bucket; the storage path never crosses the wire.",
    success: { 200: { description: "The image bytes." } },
    errors: [404, 503],
    bytes: "image/jpeg"
  },
  "GET /marketplace/campaigns/:campaignId": {
    tag: "Marketplace",
    summary: "Read one published campaign's detail",
    description: "AUTHENTICATED (any role). Unpublished or unknown ids are 404.",
    success: { 200: { description: "The campaign detail.", schema: campaignDetailSchema } },
    errors: [400, 404, 503]
  },

  // ---- Blog ----------------------------------------------------------------
  "GET /blog": {
    tag: "Blog",
    summary: "List published blog articles",
    description: "PUBLIC. One unpaginated list of published articles. Short-lived cache.",
    success: { 200: { description: "The published articles.", schema: blogPostListSchema } },
    errors: [503]
  },
  "GET /blog/:slug": {
    tag: "Blog",
    summary: "Read one published blog article",
    description: "PUBLIC. Unknown or unpublished slugs are 404; a published row whose Markdown cannot be read is 503.",
    success: { 200: { description: "The article with its front matter stripped.", schema: blogPostSchema } },
    errors: [404, 503]
  },

  // ---- Assistant -----------------------------------------------------------
  "POST /assistant/questions": {
    tag: "Assistant",
    summary: "Ask the help assistant",
    description:
      "PYME or INVERSOR, and only when the per-user chat access is enabled. Answers only from the compiled wiki: an out-of-scope question is declined and an uncovered one is the fixed no-documentation answer. 5 questions per user per rolling 24h. One JSON body — no streaming.",
    request: { contentType: "application/json", schema: assistantQuestionCommandSchema },
    success: { 200: { description: "The answer and the wiki pages it cites.", schema: assistantAnswerSchema } },
    errors: [400, 401, 403, 503]
  },

  // ---- PyME ----------------------------------------------------------------
  "POST /sme-requests": {
    tag: "PyME",
    summary: "Submit the PyME application to human review",
    description: "PYME-only. Idempotent per owner+content: a replay answers 200 with `applied: false`. The wallet key is read from the verified principal; a missing key is 409 `wallet_required`.",
    request: { contentType: "application/json", schema: smeRequestSchema },
    success: {
      201: { description: "Applied (a new application).", schema: smeRequestSubmissionSchema },
      200: { description: "Idempotent replay (`applied: false`).", schema: smeRequestSubmissionSchema }
    },
    errors: [400, 401, 409, 503]
  },
  "GET /sme-requests": {
    tag: "Admin",
    summary: "Admin PyMEs queue (paginated, filtered, counted)",
    description: "ADMIN-only. Server-side pagination, sorting, search and per-state counts. Query: `page, pageSize, sort, order, q, state`.",
    success: { 200: { description: "One page plus global per-state counts." } },
    errors: AUTH_READ
  },
  "GET /sme-requests/:applicationId": {
    tag: "PyME",
    summary: "Read the caller's own application",
    description: "PYME-only. A foreign owner is 404 (never 403).",
    success: { 200: { description: "The request, its sales periods and state.", schema: smeRequestReadSchema } },
    errors: OWNED_READ
  },
  "GET /sme-requests/mine": {
    tag: "PyME",
    summary: "Read the caller's own application id and state",
    description: "PYME-only. Returns the owner's latest application and its real review state, or `application: null` when there is none. The owner is the verified principal, resolved server-side.",
    success: { 200: { description: "`{ application }`; null when the caller owns none.", schema: myApplicationReadSchema } },
    errors: AUTH
  },
  "GET /pyme-documents/mine": {
    tag: "PyME",
    summary: "List the caller's own uploaded documents (metadata only)",
    description: "PYME-only. Metadata only; the storage object path never crosses the wire. The owner is the verified principal, resolved server-side.",
    success: { 200: { description: "`{ documents }`.", schema: myDocumentsReadSchema } },
    errors: AUTH
  },
  "POST /businesses": {
    tag: "PyME",
    summary: "Register (or update) the PyME company",
    description: "PYME-only. Body validated inline (`name, cuit, sector, city, description, goalArs, revenueShare, deadline?, campaignDurationDays?, useOfFunds?`). `useOfFunds` is optional free text (trimmed, at most 2000 characters; absent, null or blank stores none).",
    request: INLINE_BODY("Company draft, validated inline."),
    success: { 201: { description: "The stored business." } },
    errors: [400, 401, 503]
  },
  "GET /businesses/mine": {
    tag: "PyME",
    summary: "Read the caller's own company",
    description: "PYME-only. 404 until a company is registered. `useOfFunds` is omitted when the company declared none.",
    success: { 200: { description: "The stored business." } },
    errors: AUTH_READ
  },
  "POST /completeness-check": {
    tag: "PyME",
    summary: "Completeness check of the declared application",
    description: "PYME-only. Body validated inline (`documents, photoCount, salesMonths`). Incomplete warns; it never blocks the send.",
    request: INLINE_BODY("Declared metadata, validated inline."),
    success: { 200: { description: "`{ complete, findings[] }`; `complete` is false exactly on a `gap`." } },
    errors: [400, 401, 503]
  },
  "GET /businesses/:businessId/sales-periods": {
    tag: "PyME",
    summary: "List a business's declared sales periods",
    description: "PYME (own) or ADMIN. A foreign PyME is 404.",
    success: { 200: { description: "`{ businessId, periods[] }`." } },
    errors: [401, 404, 503]
  },
  "POST /businesses/:businessId/sales-periods": {
    tag: "PyME",
    summary: "Add a declared sales period (or seed the demo)",
    description: "PYME-only. Accepts a declared request or an empty object to run the demo seed.",
    request: { contentType: "application/json", schema: declaredSalesRequestSchema },
    success: {
      201: { description: "Applied (demo seed)." },
      200: { description: "The business's periods, or an idempotent replay." }
    },
    errors: [400, 401, 404, 503]
  },
  "GET /my-campaigns": {
    tag: "PyME",
    summary: "The PyME's own campaigns dashboard",
    description: "PYME-only. The owner is the verified principal, resolved server-side.",
    success: { 200: { description: "The caller's campaigns.", schema: myCampaignsSchema } },
    errors: AUTH
  },

  // ---- Wallet --------------------------------------------------------------
  "POST /profile/wallet/challenge": {
    tag: "Wallet",
    summary: "Issue a single-use wallet-connection challenge",
    description: "PYME or INVERSOR.",
    success: { 201: { description: "`{ challengeId, message }`." } },
    errors: AUTH_READ
  },
  "POST /profile/wallet": {
    tag: "Wallet",
    summary: "Submit the signed wallet connection",
    description: "PYME or INVERSOR. Body validated inline (`challengeId, publicKey, signature`).",
    request: INLINE_BODY("Signed challenge."),
    success: { 200: { description: "`{ publicKey, frozen }`." } },
    errors: [400, 401, 404, 409, 503]
  },
  "GET /profile/wallet": {
    tag: "Wallet",
    summary: "Read the stored wallet key and frozen state",
    description: "PYME or INVERSOR.",
    success: { 200: { description: "`{ publicKey, frozen }`; `publicKey` is null until connected." } },
    errors: AUTH
  },

  // ---- Storage -------------------------------------------------------------
  "POST /storage/uploads": {
    tag: "Storage",
    summary: "Upload a document or photo",
    description: "PYME-only. Multipart `file` + `kind`. 10 MB cap; PDF/JPG/PNG.",
    request: { contentType: "multipart/form-data", description: "`file` plus the `kind` field." },
    success: { 201: { description: "`{ path, kind, name, size, contentType }`." } },
    errors: [400, 401, 413, 415, 503]
  },
  "DELETE /storage/uploads": {
    tag: "Storage",
    summary: "Delete an uploaded object",
    description: "PYME-only. Ownership enforced inline.",
    success: { 204: { description: "Deleted." } },
    errors: [400, 401, 403, 503]
  },
  "GET /storage/uploads": {
    tag: "Storage",
    summary: "Read an uploaded object's bytes",
    description: "ADMIN-only.",
    success: { 200: { description: "The object bytes." } },
    errors: [400, 404, 503],
    bytes: "application/octet-stream"
  },

  // ---- Assessments & review pipeline --------------------------------------
  "POST /assessments": {
    tag: "Assessments",
    summary: "Run the AI assessment over an evidence bundle",
    description: "ADMIN-only. Advisory: the AI never approves, calculates obligations or moves funds.",
    request: { contentType: "application/json", description: "`{ evidence }`, parsed by `@vaqcrow/ai`." },
    success: { 200: { description: "`{ assessment, metadata }`." } },
    errors: [400, 502, 503, 504]
  },
  "POST /application-reviews/:applicationId/assessments": {
    tag: "Assessments",
    summary: "Attach an assessment outcome to an application",
    description: "ADMIN-only. Body is exactly `{ handoffId }`.",
    request: { contentType: "application/json", description: "`{ handoffId }`." },
    success: {
      201: { description: "Applied.", schema: applicationAssessmentOutcomeSchema },
      200: { description: "Idempotent replay.", schema: applicationAssessmentOutcomeSchema }
    },
    errors: [400, 404, 409, 503]
  },
  "GET /application-reviews/:applicationId/assessment": {
    tag: "Assessments",
    summary: "Read an application's assessment",
    description: "ADMIN-only.",
    success: { 200: { description: "The recorded assessment.", schema: applicationAssessmentReadSchema } },
    errors: ADMIN_DETAIL
  },
  "GET /application-reviews/:applicationId/context": {
    tag: "Assessments",
    summary: "Read the full admin review context",
    description: "ADMIN-only aggregate: review, request, company, documents, assessment, latest decision, verdicts.",
    success: { 200: { description: "The review context." } },
    errors: ADMIN_DETAIL
  },
  "GET /application-reviews/:applicationId/manual-review": {
    tag: "Assessments",
    summary: "Read the manual-review context",
    description: "ADMIN-only.",
    success: { 200: { description: "The manual-review context.", schema: applicationManualReviewContextSchema } },
    errors: ADMIN_DETAIL
  },
  "POST /application-reviews/:applicationId/decisions": {
    tag: "Assessments",
    summary: "Record a human decision",
    description: "ADMIN-only. The actor is the verified principal's display name, never the body. Body keys: `decisionId, outcome, reason, approvedLimitArs`.",
    request: { contentType: "application/json", schema: humanDecisionCommandSchema },
    success: {
      201: { description: "Applied.", schema: humanDecisionRecordSchema },
      200: { description: "Idempotent replay.", schema: humanDecisionRecordSchema }
    },
    errors: [400, 401, 404, 409, 503]
  },
  "GET /application-reviews/:applicationId/decisions": {
    tag: "Assessments",
    summary: "Read the latest human decision",
    description: "ADMIN-only. `{ decision }` is null when none was recorded.",
    success: { 200: { description: "`{ decision }`.", schema: humanDecisionRecordSchema } },
    errors: ADMIN_DETAIL
  },
  "PUT /application-reviews/:applicationId/documents/:documentId/verdict": {
    tag: "Assessments",
    summary: "Record a per-document KYC/KYB verdict",
    description: "ADMIN-only.",
    request: { contentType: "application/json", schema: documentVerdictCommandSchema },
    success: { 200: { description: "`{ applied, verdict }`." } },
    errors: [400, 401, 404, 409, 503]
  },
  "POST /application-reviews/:applicationId/deployment": {
    tag: "Campaigns",
    summary: "Deploy the campaign vault (or retry)",
    description: "ADMIN-only. Platform-signed factory deployment; the PyME account is the immutable destination. Registered only when the campaign slice is configured.",
    success: { 200: { description: "`{ deployment }`." } },
    errors: [400, 404, 409, 422, 503]
  },
  "GET /application-reviews/:applicationId/deployment": {
    tag: "Campaigns",
    summary: "Read the deployment record",
    description: "ADMIN-only.",
    success: { 200: { description: "`{ deployment }`." } },
    errors: ADMIN_DETAIL
  },
  "GET /application-reviews/:applicationId/evidence": {
    tag: "Assessments",
    summary: "Read the per-application Testnet evidence chain",
    description: "ADMIN-only, read-only from the stored mirror. Hashes prove technical execution, not an investment.",
    success: { 200: { description: "The evidence chain.", schema: adminApplicationEvidenceSchema } },
    errors: ADMIN_DETAIL
  },

  // ---- Admin: users, roles, invitations, audit, rates ---------------------
  "GET /admin/users": {
    tag: "Admin",
    summary: "Admin › Usuarios list",
    description: "ADMIN-only. The caller's identity never scopes the listing. Query: `search, role, status, page, pageSize`.",
    success: { 200: { description: "One page of users.", schema: adminUsersPageSchema } },
    errors: AUTH_READ
  },
  "GET /admin/audit-log": {
    tag: "Admin",
    summary: "Admin audit log",
    description: "ADMIN-only. Query: `search, page, pageSize`.",
    success: { 200: { description: "One page of audit entries.", schema: auditLogPageSchema } },
    errors: AUTH_READ
  },
  "POST /admin/users/:userId/activation": {
    tag: "Admin",
    summary: "Activate or deactivate a user",
    description: "ADMIN-only. Deactivation is effective: the authorization hook answers 401 for an inactive profile. Domain rules (last active admin) are enforced by the use case.",
    request: { contentType: "application/json", schema: setUserActiveCommandSchema },
    success: { 200: { description: "`{ userId, active }`." } },
    errors: [400, 401, 404, 409, 503]
  },
  "POST /admin/users/:userId/role": {
    tag: "Admin",
    summary: "Change a user's role",
    description: "ADMIN-only. PYME↔INVERSOR only.",
    request: { contentType: "application/json", schema: changeUserRoleCommandSchema },
    success: { 200: { description: "`{ userId, role }`." } },
    errors: [400, 401, 404, 409, 503]
  },
  "POST /admin/users/:userId/chat-access": {
    tag: "Admin",
    summary: "Enable or disable a user's assistant access",
    description: "ADMIN-only. The per-user assistant flag is off by default (#499/WU2, D9).",
    request: { contentType: "application/json", schema: setChatAccessCommandSchema },
    success: { 200: { description: "`{ userId, enabled }`.", schema: setChatAccessResultSchema } },
    errors: [400, 401, 404, 503]
  },
  "POST /admin/invitations": {
    tag: "Admin",
    summary: "Invite an operator",
    description: "ADMIN-only. The body carries only the invitee's email; the actor is the verified principal.",
    request: { contentType: "application/json", schema: inviteOperatorCommandSchema },
    success: { 200: { description: "The invited operator.", schema: inviteOperatorResultSchema } },
    errors: [400, 401, 409, 503]
  },
  "POST /admin/invitations/accept": {
    tag: "Admin",
    summary: "Accept an operator invitation",
    description: "AUTHENTICATED (the invitee). Only the caller's own profile is edited.",
    request: { contentType: "application/json", schema: acceptOperatorInvitationCommandSchema },
    success: { 200: { description: "`{ userId, displayName }`." } },
    errors: [400, 401, 404, 503]
  },
  "POST /admin/rates": {
    tag: "Admin",
    summary: "Record a new FX rate version",
    description: "ADMIN-only. Body validated inline (`version, effectiveAt, source, usdToArs, stroopsPerUsd`).",
    request: INLINE_BODY("A new rate version, validated inline."),
    success: { 201: { description: "`{ rate }`." } },
    errors: [400, 401, 409, 503]
  },
  "GET /admin/rates/current": {
    tag: "Admin",
    summary: "Read the current FX rate",
    description: "ADMIN-only.",
    success: { 200: { description: "`{ rate }`." } },
    errors: [404, 503]
  },
  "GET /rates/current": {
    tag: "Wallet",
    summary: "Read the current FX rate (public fields)",
    description:
      "AUTHENTICATED (any role). `{ rate: { version, effectiveAt, usdToArs, stroopsPerUsd } }` for the simulated ARS equivalent of the wallet balance (#572); never the author or the source. 404 when no rate is in effect.",
    success: { 200: { description: "`{ rate }`." } },
    errors: [401, 404, 503]
  },

  // ---- Campaigns & Stellar invocations ------------------------------------
  "POST /campaigns": {
    tag: "Campaigns",
    summary: "Open a campaign (deploy the vault)",
    description: "ADMIN-only. Platform-signed deploy with the PyME account as the immutable destination. Body keys: `applicationId, smeAccountId, goalStroops, deadline`.",
    request: { contentType: "application/json", schema: openCampaignCommandSchema },
    success: {
      201: { description: "Deployed.", schema: campaignSnapshotSchema },
      200: { description: "Idempotent replay.", schema: campaignSnapshotSchema }
    },
    errors: [400, 404, 409, 422, 503]
  },
  "GET /campaigns/:campaignId": {
    tag: "Campaigns",
    summary: "Read a campaign snapshot",
    description: "AUTHENTICATED (any role). The optional `investor` query narrows the snapshot to that account.",
    success: { 200: { description: "`{ campaign }`.", schema: campaignSnapshotSchema } },
    errors: [400, 404, 503]
  },
  "GET /campaigns/:campaignId/transactions/:hash": {
    tag: "Campaigns",
    summary: "Read a submitted transaction's status",
    description: "AUTHENTICATED (any role).",
    success: { 200: { description: "The transaction status.", schema: contractInvocationTransactionStatusSchema } },
    errors: CONDITIONAL
  },
  "POST /campaigns/:campaignId/invocations": {
    tag: "Campaigns",
    summary: "Prepare a contract invocation (unsigned XDR)",
    description: "AUTHENTICATED (any role). Builds the transaction the person signs in Freighter; the API never signs for the user.",
    request: { contentType: "application/json", schema: prepareContractInvocationCommandSchema },
    success: { 200: { description: "`{ contractInvocation }` (unsigned).", schema: contractInvocationSchema } },
    errors: CONDITIONAL
  },
  "POST /campaigns/:campaignId/invocations/submission": {
    tag: "Campaigns",
    summary: "Submit a signed contract invocation",
    description: "AUTHENTICATED (any role). `202` is accepted, never a final settlement.",
    request: { contentType: "application/json", schema: submitContractInvocationCommandSchema },
    success: { 202: { description: "Accepted for submission.", schema: contractInvocationSubmissionSchema } },
    errors: CONDITIONAL
  },

  // ---- Revenue-share distributions ----------------------------------------
  "POST /revenue-share-distributions": {
    tag: "Distributions",
    summary: "Prepare a monthly revenue-share distribution",
    description: "PYME-only. Builds the unsigned distribution tx the PyME signs. Body keys: `sourceAccountId, applicationId, campaignId, memo`.",
    request: { contentType: "application/json", schema: prepareRevenueShareDistributionCommandSchema },
    success: { 200: { description: "`{ distribution }` (unsigned).", schema: preparedRevenueShareDistributionSchema } },
    errors: [400, 401, 404, 409, 422, 503]
  },
  "POST /revenue-share-distributions/:distributionId/submission": {
    tag: "Distributions",
    summary: "Submit a signed distribution",
    description: "PYME-only. `202` is accepted, never a final settlement.",
    request: { contentType: "application/json", schema: submitRevenueShareDistributionCommandSchema },
    success: {
      202: { description: "Accepted.", schema: revenueShareDistributionSnapshotSchema },
      200: { description: "Idempotent replay.", schema: revenueShareDistributionSnapshotSchema }
    },
    errors: [400, 401, 404, 409, 422, 503]
  },
  "GET /revenue-share-distributions/:distributionId": {
    tag: "Distributions",
    summary: "Read a distribution",
    description: "PYME (own) or ADMIN.",
    success: { 200: { description: "`{ distribution }`.", schema: revenueShareDistributionSnapshotSchema } },
    errors: [400, 404, 503]
  },

  // ---- Notifications -------------------------------------------------------
  "GET /notifications": {
    tag: "Notifications",
    summary: "List the caller's notifications",
    description: "AUTHENTICATED (any role). The recipient is the verified principal; a body/query recipient is ignored.",
    success: { 200: { description: "`{ notifications }`, newest first." } },
    errors: AUTH
  },
  "GET /notifications/unread-count": {
    tag: "Notifications",
    summary: "The unread badge count",
    description: "AUTHENTICATED (any role).",
    success: { 200: { description: "`{ unread }`." } },
    errors: AUTH
  },
  "POST /notifications/:notificationId/read": {
    tag: "Notifications",
    summary: "Mark one notification read",
    description: "AUTHENTICATED (any role). Only an unread row matches.",
    success: { 200: { description: "`{ read: true }`." } },
    errors: [400, 401, 404, 503]
  },
  "POST /notifications/read-all": {
    tag: "Notifications",
    summary: "Mark every notification read",
    description: "AUTHENTICATED (any role).",
    success: { 200: { description: "`{ updated }`." } },
    errors: AUTH
  },

  // ---- Favorites, KYC, portfolio, reports ---------------------------------
  "GET /favorites": {
    tag: "Favorites",
    summary: "List the caller's favorite campaign ids",
    description: "AUTHENTICATED (any role). The owner is the verified principal.",
    success: { 200: { description: "`{ campaignIds }`.", schema: favoriteCampaignListSchema } },
    errors: AUTH
  },
  "PUT /favorites/:campaignId": {
    tag: "Favorites",
    summary: "Save a campaign as favorite",
    description: "AUTHENTICATED (any role). Idempotent.",
    success: { 200: { description: "`{ campaignId, applied }`.", schema: favoriteCampaignResultSchema } },
    errors: [400, 401, 404, 503]
  },
  "DELETE /favorites/:campaignId": {
    tag: "Favorites",
    summary: "Remove a favorite campaign",
    description: "AUTHENTICATED (any role). Idempotent.",
    success: { 200: { description: "`{ campaignId, applied }`.", schema: favoriteCampaignResultSchema } },
    errors: [400, 401, 404, 503]
  },
  "GET /investor-kyc": {
    tag: "Investor",
    summary: "Read the caller's simulated investor KYC",
    description: "AUTHENTICATED (any role). The KYC is simulated.",
    success: { 200: { description: "The KYC record.", schema: investorKycSchema } },
    errors: AUTH
  },
  "POST /investor-kyc": {
    tag: "Investor",
    summary: "Record (auto-approve) the simulated investor KYC",
    description: "AUTHENTICATED (any role). Auto-approved at the first contribution; admins never approve investors manually.",
    success: {
      201: { description: "Created.", schema: investorKycSchema },
      200: { description: "Idempotent replay.", schema: investorKycSchema }
    },
    errors: AUTH
  },
  "GET /portfolio": {
    tag: "Investor",
    summary: "The investor's portfolio",
    description: "INVERSOR-only. The Stellar account is resolved server-side from the verified principal.",
    success: { 200: { description: "The portfolio summary.", schema: portfolioSummarySchema } },
    errors: AUTH
  },
  "GET /reports": {
    tag: "Investor",
    summary: "The investor report",
    description: "AUTHENTICATED (any role). Query `from`/`to` are inclusive `YYYY-MM` months; both-or-none.",
    success: { 200: { description: "The report (with `isEmpty`).", schema: investorReportSchema } },
    errors: AUTH_READ
  },
  "GET /reports/sales-by-pyme": {
    tag: "Investor",
    summary: "The declared-sales block of the report",
    description: "AUTHENTICATED (any role). Read on its own so the block keeps its own partial-error state. Query `from`/`to` are inclusive `YYYY-MM` months; both-or-none.",
    success: { 200: { description: "The sales-by-PyME block.", schema: reportSalesByPymeSchema } },
    errors: AUTH_READ
  },

  // ---- Legacy (in the authorization table, not wired) ---------------------
  "POST /funding-intents": {
    tag: "Legacy",
    summary: "Prepare a funding intent (legacy)",
    description: "Present in the authorization table but **not wired** in the running composition.",
    request: { contentType: "application/json", schema: prepareFundingIntentCommandSchema },
    success: { 200: { description: "`{ intent }` (unsigned).", schema: preparedFundingIntentSchema } },
    errors: [400, 404, 503]
  },
  "POST /funding-intents/:intentId/submission": {
    tag: "Legacy",
    summary: "Submit a signed funding intent (legacy)",
    description: "Not wired in the running composition.",
    request: { contentType: "application/json", schema: submitFundingIntentCommandSchema },
    success: {
      202: { description: "Accepted.", schema: fundingIntentSnapshotSchema },
      200: { description: "Idempotent replay.", schema: fundingIntentSnapshotSchema }
    },
    errors: [400, 409, 422, 503]
  },
  "GET /funding-intents/:intentId": {
    tag: "Legacy",
    summary: "Read a funding intent (legacy)",
    description: "Not wired in the running composition.",
    success: { 200: { description: "`{ intent }`.", schema: fundingIntentSnapshotSchema } },
    errors: [400, 404, 503]
  }
};

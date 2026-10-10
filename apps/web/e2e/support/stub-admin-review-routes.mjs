/**
 * Deterministic local double for the admin review HTTP contracts (Feature
 * #410, UI phase U7). Mirrors the routes and wire shapes the web's
 * `HttpAdminQueueGateway` and `HttpAdminReviewGateway` drive, as the real
 * API serves them:
 *
 * - `GET /sme-requests` (ADMIN queue, `sme-request.route.ts`):
 *   `{ items, page, pageSize, total, counts }`.
 * - `GET /application-reviews/:id/context` (`admin-review-context.route.ts`).
 * - `PUT /application-reviews/:id/documents/:documentId/verdict`
 *   (`document-verdict.route.ts`): body exactly `{ verdict }`, `200 { applied, verdict }`,
 *   `409 { code: "state_conflict", actualState }` once decided.
 * - `POST /application-reviews/:id/decisions` (`human-decision.route.ts`): body
 *   exactly `{ decisionId, outcome, reason, approvedLimitArs }` — an `actor` key is
 *   a 400 like the real route; `201`/`200` on replay; `409 state_conflict`.
 * - `GET`/`POST /application-reviews/:id/deployment` (`campaign-deployment.route.ts`):
 *   `{ deployment }` with the server-decided `retryable` (U8); a 404 before any
 *   deployment exists; `409 deployment_in_progress` for a fresh attempt.
 * - `GET /storage/uploads?path=` (`storage.route.ts`): the private document's bytes.
 *
 * It is a test double, not a backend: the bearer token is required but never
 * verified (the real API verifies it and resolves the ADMIN role), and the
 * recorded actor is the seeded admin's display name, exactly what the real API
 * would take from the verified principal. Every value is a frozen literal, so
 * two runs observe byte-identical responses. Nothing here reaches Stellar
 * Testnet, Supabase or an LLM provider: the vault deployment is a scripted
 * state machine (`failed` after the approval, `confirmed` after Reintentar).
 *
 * Scenario control is a test-only endpoint, `POST /__admin-review/seed`, never a
 * header or a hidden field on the production-shaped routes.
 */

/** UUID v4 ids (the contracts validate `z.uuidv4()` / `z.uuid()`). */
export const REVIEW_APPLICATION_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OWNER_USER_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const SEEDED_DECISION_ID = "6f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b";
const CORRELATION_ID = "11111111-2222-4333-8444-555555555555";
const CAMPAIGN_ID = "50000000-0000-4000-8000-000000000000";

/** The display name the supabase double seeds for the e2e admin (`/__seed-admin`). */
export const ADMIN_DISPLAY_NAME = "Admin Vaqcrow";

const SUBMITTED_AT = "2026-10-06T12:00:00.000Z";
const VERDICT_AT = "2026-10-07T12:00:00.000Z";
const DECIDED_AT = "2026-10-07T12:05:00.000Z";
const DEPLOYMENT_CREATED_AT = "2026-10-07T12:05:01.000Z";
const DEPLOYMENT_UPDATED_AT = "2026-10-07T12:05:02.000Z";
const DEPLOYMENT_CONFIRMED_AT = "2026-10-07T12:06:00.000Z";

const COMPANY = Object.freeze({
  businessId: "b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  ownerUserId: OWNER_USER_ID,
  name: "Panadería Horizonte SRL",
  cuit: "30-71234567-8",
  sector: "Gastronomía",
  city: "Rosario",
  description: "Panadería de barrio que necesita un horno nuevo (datos sintéticos).",
  goalArs: 12000000,
  revenueShare: 5,
  deadline: null,
  createdAt: SUBMITTED_AT,
  updatedAt: SUBMITTED_AT
});

const SME_REQUEST = Object.freeze({
  applicationId: REVIEW_APPLICATION_ID,
  ownerUserId: OWNER_USER_ID,
  request: {
    smeReference: "sme:SYN-PH-0001",
    declaredTotalArs: 26137750,
    periodStart: "2026-01",
    periodEnd: "2026-08",
    simuladoLabel: "SIMULADO"
  }
});

/** The PyME's uploaded documents: three mandatory PDFs and one PNG photo. */
export const REVIEW_DOCUMENTS = Object.freeze([
  {
    documentId: "a0000001-0000-4000-8000-000000000001",
    kind: "cuit",
    objectPath: `${OWNER_USER_ID}/cuit/constancia-cuit.pdf`,
    name: "constancia-cuit.pdf",
    sizeBytes: 64,
    contentType: "application/pdf",
    createdAt: SUBMITTED_AT
  },
  {
    documentId: "a0000002-0000-4000-8000-000000000002",
    kind: "articles-of-incorporation",
    objectPath: `${OWNER_USER_ID}/articles-of-incorporation/contrato-social.pdf`,
    name: "contrato-social.pdf",
    sizeBytes: 64,
    contentType: "application/pdf",
    createdAt: SUBMITTED_AT
  },
  {
    documentId: "a0000003-0000-4000-8000-000000000003",
    kind: "sales-declarations",
    objectPath: `${OWNER_USER_ID}/sales-declarations/ventas.pdf`,
    name: "ventas.pdf",
    sizeBytes: 64,
    contentType: "application/pdf",
    createdAt: SUBMITTED_AT
  },
  {
    documentId: "a0000004-0000-4000-8000-000000000004",
    kind: "photo",
    objectPath: `${OWNER_USER_ID}/photo/local.png`,
    name: "local.png",
    sizeBytes: 68,
    contentType: "image/png",
    createdAt: SUBMITTED_AT
  }
]);

/** Contract-shaped persisted assessment (strict `applicationAssessmentReadSchema`). */
const ASSESSMENT = Object.freeze({
  assessment: {
    assessmentId: "asm_stub_admin_001",
    riskBand: "medium",
    confidence: 0.72,
    reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
    anomalies: [{ type: "outlier", evidenceRef: "sales:2026-06", severity: "review" }],
    missingData: ["Declaración del período 2026-04"],
    recommendedAction: "human_review",
    questions: ["¿Qué explica el incremento de junio?"]
  },
  metadata: {
    model: "simulated-underwriter",
    promptVersion: "prompt-v1",
    generatedAt: "2026-10-06T12:30:00.000Z",
    source: "simulated"
  },
  recordedAt: "2026-10-06T12:30:01.000Z"
});

/** Smallest valid PDF and a 1×1 PNG: real bytes, frozen literals. */
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "latin1");
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

const DECIDED_STATES = new Set(["approved", "changes_requested", "rejected"]);
const VERDICT_EDITABLE_STATES = new Set(["awaiting_assessment", "human_review"]);
const REVIEW_STATES = new Set(["draft", "awaiting_assessment", "human_review", ...DECIDED_STATES]);
const VERDICTS = new Set(["valid", "request", "invalid"]);
const OUTCOMES = new Set(["approved", "changes_requested", "rejected"]);
const DECISION_KEYS = ["approvedLimitArs", "decisionId", "outcome", "reason"];
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let state = "human_review";
/** documentId -> verdict record */
const verdicts = new Map();
let latestDecision = null;
let deployment = null;

export function resetAdminReviewFixtures() {
  state = "human_review";
  verdicts.clear();
  latestDecision = null;
  deployment = null;
}

function seededDecision(outcome) {
  return {
    decisionId: SEEDED_DECISION_ID,
    applicationId: REVIEW_APPLICATION_ID,
    outcome,
    actor: ADMIN_DISPLAY_NAME,
    reason: "Decisión registrada antes de abrir la revisión (e2e).",
    approvedLimitArs: outcome === "approved" ? COMPANY.goalArs : null,
    decidedAt: DECIDED_AT,
    correlationId: CORRELATION_ID
  };
}

function failedDeployment() {
  return {
    applicationId: REVIEW_APPLICATION_ID,
    state: "failed",
    attempts: 1,
    lastError: "rate_unavailable",
    // The real API decides `retryable` server-side (U8): a failed attempt is.
    retryable: true,
    createdAt: DEPLOYMENT_CREATED_AT,
    updatedAt: DEPLOYMENT_UPDATED_AT
  };
}

function queueDisplayGroup(reviewState) {
  if (reviewState === "changes_requested") return "changes";
  if (reviewState === "approved" || reviewState === "rejected") return reviewState;
  return "pending";
}

function hasBearer(request) {
  return /^Bearer \S+$/.test(request.headers["authorization"] ?? "");
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function contextBody() {
  return {
    applicationReview: { applicationId: REVIEW_APPLICATION_ID, state },
    smeRequest: SME_REQUEST,
    company: COMPANY,
    documents: REVIEW_DOCUMENTS,
    documentVerdicts: [...verdicts.values()],
    assessment: ASSESSMENT,
    latestHumanDecision: latestDecision
  };
}

const CONTEXT_PATH = /^\/application-reviews\/([^/]+)\/context$/;
const VERDICT_PATH = /^\/application-reviews\/([^/]+)\/documents\/([^/]+)\/verdict$/;
const DECISION_PATH = /^\/application-reviews\/([^/]+)\/decisions$/;
const DEPLOYMENT_PATH = /^\/application-reviews\/([^/]+)\/deployment$/;
const EVIDENCE_PATH = /^\/application-reviews\/([^/]+)\/evidence$/;

/**
 * `GET /application-reviews/:id/evidence` (#438 WU4): the chain as this double
 * knows it — the review state, the recorded decision and deployment, and no
 * vault, contributions, distributions or reconciliation (the double never
 * mirrors a vault). Explorer links stay out of it: the web never builds one.
 */
function evidenceBody() {
  return {
    applicationId: REVIEW_APPLICATION_ID,
    applicationState: state,
    smeReference: SME_REQUEST.request.smeReference,
    companyName: COMPANY.name,
    decision:
      latestDecision === null
        ? null
        : {
            actor: latestDecision.actor,
            outcome: latestDecision.outcome,
            reason: latestDecision.reason,
            approvedLimitArs: latestDecision.approvedLimitArs,
            decidedAt: latestDecision.decidedAt
          },
    deployment: deployment === null ? null : { state: deployment.state, campaignId: deployment.campaignId ?? null },
    vault: null,
    contributions: [],
    distributions: [],
    reconciliation: null
  };
}

/**
 * Handles the admin review routes; returns `false` for anything else so the
 * caller keeps routing. `helpers` are the server's `sendJson` / `readJsonBody`.
 */
export async function tryHandleAdminReviewRequest(request, response, method, pathname, url, helpers) {
  const { sendJson, readJsonBody, corsHeaders } = helpers;

  if (method === "POST" && pathname === "/__admin-review/seed") {
    const body = (await readJsonBody(request)) ?? {};
    resetAdminReviewFixtures();
    if (typeof body.state === "string" && REVIEW_STATES.has(body.state)) state = body.state;
    if (DECIDED_STATES.has(state)) latestDecision = seededDecision(state);
    // `deployment: "none"` seeds an approval whose background deploy never
    // recorded a row (U8), so the panel offers Desplegar.
    if (state === "approved" && body.deployment !== "none") deployment = failedDeployment();
    response.writeHead(204, corsHeaders);
    response.end();
    return true;
  }

  // Test-only: the review moves under the admin's feet (another admin decided).
  if (method === "POST" && pathname === "/__admin-review/decide-elsewhere") {
    const body = (await readJsonBody(request)) ?? {};
    const outcome = OUTCOMES.has(body.outcome) ? body.outcome : "rejected";
    state = outcome;
    latestDecision = seededDecision(outcome);
    response.writeHead(204, corsHeaders);
    response.end();
    return true;
  }

  const isQueue = method === "GET" && pathname === "/sme-requests";
  const isStorageRead = method === "GET" && pathname === "/storage/uploads";
  const contextMatch = CONTEXT_PATH.exec(pathname);
  const verdictMatch = VERDICT_PATH.exec(pathname);
  // Every decision write is claimed here; an unknown application is a truthful 404.
  const decisionMatch = method === "POST" ? DECISION_PATH.exec(pathname) : null;
  const deploymentMatch = DEPLOYMENT_PATH.exec(pathname);
  const evidenceMatch = method === "GET" ? EVIDENCE_PATH.exec(pathname) : null;
  if (!isQueue && !isStorageRead && !contextMatch && !verdictMatch && !decisionMatch && !deploymentMatch && !evidenceMatch) {
    return false;
  }

  // Every admin route requires a bearer token; the real API also verifies the ADMIN role.
  if (!hasBearer(request)) {
    sendJson(response, 401, { code: "unauthenticated" });
    return true;
  }

  if (isQueue) {
    const group = queueDisplayGroup(state);
    const filter = url.searchParams.get("state");
    const items =
      filter === null || filter === group
        ? [{ applicationId: REVIEW_APPLICATION_ID, name: COMPANY.name, sector: COMPANY.sector, state, updatedAt: SUBMITTED_AT }]
        : [];
    const counts = { pending: 0, changes: 0, approved: 0, rejected: 0 };
    counts[group] = 1;
    sendJson(response, 200, {
      items,
      page: Number(url.searchParams.get("page") ?? 1) || 1,
      pageSize: Number(url.searchParams.get("pageSize") ?? 20) || 20,
      total: items.length,
      counts
    });
    return true;
  }

  if (isStorageRead) {
    const path = url.searchParams.get("path") ?? "";
    const document = REVIEW_DOCUMENTS.find((entry) => entry.objectPath === path);
    if (!document) {
      sendJson(response, path.trim() === "" ? 400 : 404, { code: path.trim() === "" ? "invalid_request" : "not_found" });
      return true;
    }
    const bytes = document.contentType === "image/png" ? PNG_BYTES : PDF_BYTES;
    response.writeHead(200, {
      ...corsHeaders,
      "Content-Type": document.contentType,
      "Content-Length": bytes.length,
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${document.name}"`,
      "X-Content-Type-Options": "nosniff"
    });
    response.end(bytes);
    return true;
  }

  const applicationId = decodeURIComponent(
    (contextMatch ?? verdictMatch ?? decisionMatch ?? deploymentMatch ?? evidenceMatch)[1]
  );
  if (!UUID_V4.test(applicationId)) {
    sendJson(response, 400, { code: "invalid_request" });
    return true;
  }
  const known = applicationId === REVIEW_APPLICATION_ID;

  if (evidenceMatch) {
    if (!known) sendJson(response, 404, { code: "not_found" });
    else sendJson(response, 200, evidenceBody());
    return true;
  }

  if (contextMatch) {
    if (method !== "GET") return false;
    if (!known) sendJson(response, 404, { code: "not_found" });
    else sendJson(response, 200, contextBody());
    return true;
  }

  if (verdictMatch) {
    if (method !== "PUT") return false;
    const body = await readJsonBody(request).catch(() => undefined);
    if (!isPlainObject(body) || Object.keys(body).length !== 1 || !VERDICTS.has(body.verdict)) {
      sendJson(response, 400, { code: "invalid_request" });
      return true;
    }
    const documentId = decodeURIComponent(verdictMatch[2]);
    if (!known || !REVIEW_DOCUMENTS.some((entry) => entry.documentId === documentId)) {
      sendJson(response, 404, { code: "not_found" });
      return true;
    }
    if (!VERDICT_EDITABLE_STATES.has(state)) {
      sendJson(response, 409, { code: "state_conflict", actualState: state });
      return true;
    }
    const previous = verdicts.get(documentId);
    const applied = previous?.verdict !== body.verdict;
    const record = applied
      ? { documentId, verdict: body.verdict, actor: ADMIN_DISPLAY_NAME, updatedAt: VERDICT_AT }
      : previous;
    verdicts.set(documentId, record);
    sendJson(response, 200, { applied, verdict: record });
    return true;
  }

  if (decisionMatch) {
    const body = await readJsonBody(request).catch(() => undefined);
    // Exactly the four contract keys, like the real route: an `actor` is refused.
    const keys = isPlainObject(body) ? Object.keys(body).sort() : [];
    const exact = keys.length === DECISION_KEYS.length && keys.every((key, index) => key === DECISION_KEYS[index]);
    const limitValid =
      exact &&
      (body.outcome === "approved"
        ? Number.isSafeInteger(body.approvedLimitArs) && body.approvedLimitArs > 0
        : body.approvedLimitArs === null);
    const reason = exact && typeof body.reason === "string" ? body.reason.trim() : "";
    if (
      !exact ||
      !UUID_V4.test(String(body.decisionId)) ||
      !OUTCOMES.has(body.outcome) ||
      !limitValid ||
      reason.length < 1 ||
      reason.length > 1000
    ) {
      sendJson(response, 400, { code: "invalid_request" });
      return true;
    }
    if (!known) {
      sendJson(response, 404, { code: "not_found" });
      return true;
    }
    if (latestDecision !== null && latestDecision.decisionId === body.decisionId) {
      sendJson(response, 200, { applied: false, decision: latestDecision });
      return true;
    }
    if (state !== "human_review") {
      sendJson(response, 409, { code: "state_conflict", actualState: state });
      return true;
    }
    latestDecision = {
      decisionId: body.decisionId,
      applicationId,
      outcome: body.outcome,
      actor: ADMIN_DISPLAY_NAME,
      reason,
      approvedLimitArs: body.approvedLimitArs,
      decidedAt: DECIDED_AT,
      correlationId: CORRELATION_ID
    };
    state = body.outcome;
    // The real API starts the deployment on approval; this double scripts it as failed
    // (no ARS/USD rate), so Reintentar is the path to a confirmed vault.
    if (body.outcome === "approved") deployment = failedDeployment();
    sendJson(response, 201, { applied: true, decision: latestDecision });
    return true;
  }

  // deploymentMatch
  if (method === "GET") {
    if (!known || deployment === null) sendJson(response, 404, { code: "not_found" });
    else sendJson(response, 200, { deployment });
    return true;
  }
  if (method === "POST") {
    if (!known) {
      sendJson(response, 404, { code: "application_not_found" });
      return true;
    }
    if (state !== "approved") {
      sendJson(response, 409, { code: "application_not_approved" });
      return true;
    }
    // A fresh `deploying` attempt still owns the row (U8): the real API answers 409.
    if (deployment !== null && deployment.state === "deploying" && !deployment.retryable) {
      sendJson(response, 409, { code: "deployment_in_progress" });
      return true;
    }
    if (deployment === null || deployment.retryable) {
      deployment = {
        applicationId,
        state: "confirmed",
        attempts: (deployment?.attempts ?? 0) + 1,
        campaignId: CAMPAIGN_ID,
        retryable: false,
        createdAt: deployment?.createdAt ?? DEPLOYMENT_CREATED_AT,
        updatedAt: DEPLOYMENT_CONFIRMED_AT
      };
    }
    sendJson(response, 200, { deployment });
    return true;
  }
  return false;
}

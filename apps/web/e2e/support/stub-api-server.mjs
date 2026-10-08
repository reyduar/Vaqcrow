#!/usr/bin/env node
/**
 * Deterministic local double for the demo's HTTP contracts (issue #47).
 *
 * `apps/web` talks to the future `apps/api` over the contracts documented in
 * `src/infrastructure/sme/http-sme-request-gateway.ts` and
 * `src/infrastructure/decision/http-human-decision-gateway.ts`. Those endpoints do not
 * exist yet, so browser tests run against this in-process double instead of a live
 * service. It is a test double, not a backend: it validates nothing beyond shape and
 * never reaches the network.
 *
 * Every value below is a frozen literal — no `Date.now()`, no `Math.random()`, no I/O —
 * so two runs of the suite observe byte-identical responses.
 */
import { createServer } from "node:http";
import { resetCampaignFixtures, tryHandleCampaignRequest } from "./stub-campaign-routes.mjs";
import { resetDistributionFixtures, tryHandleDistributionRequest } from "./stub-distribution-routes.mjs";
import { resetAdminReviewFixtures, tryHandleAdminReviewRequest } from "./stub-admin-review-routes.mjs";

const HOST = "127.0.0.1";
const PORT = Number(process.env["STUB_API_PORT"] ?? 4310);

const SIMULADO = "SIMULADO";

/** Frozen server-side literals so assertions never race a real clock or RNG. */
const DECIDED_AT = "2026-09-19T12:00:00-03:00";
const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const CORRELATION_ID = "11111111-2222-4333-8444-555555555555";

/** The PyME company the API would own (`T3c`): ids and timestamps stay literal. */
const BUSINESS_ID = "b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const OWNER_USER_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const BUSINESS_CREATED_AT = "2026-10-04T12:00:00.000Z";

/** The PyME wallet connection (`T1c`): one fixed single-use challenge, echoed key. */
const WALLET_CHALLENGE_ID = "9c1f0a4e-2b3d-4e5f-8a6b-7c8d9e0f1a2b";
const WALLET_CHALLENGE_MESSAGE =
  "Vaqcrow wallet connection challenge\n\nSign this message to link your Stellar account (Freighter) to your Vaqcrow PyME profile.\n\nNonce: stub-nonce";

/** Contract-shaped sales history (`salesPeriodSchema` is a strict object). */
const SALES_PERIODS = Object.freeze([
  { period: "2026-01", amountArs: 3150000, status: "reported", evidenceRef: "sales:2026-01", simuladoLabel: SIMULADO },
  { period: "2026-02", amountArs: 3320500, status: "reported", evidenceRef: "sales:2026-02", simuladoLabel: SIMULADO },
  { period: "2026-03", amountArs: 3410750, status: "reported", evidenceRef: "sales:2026-03", simuladoLabel: SIMULADO },
  { period: "2026-04", amountArs: null, status: "missing", evidenceRef: "missing:2026-04", simuladoLabel: SIMULADO },
  { period: "2026-05", amountArs: 3580900, status: "reported", evidenceRef: "sales:2026-05", simuladoLabel: SIMULADO },
  { period: "2026-06", amountArs: 6240000, status: "anomalous", evidenceRef: "sales:2026-06", simuladoLabel: SIMULADO },
  { period: "2026-07", amountArs: 3690300, status: "reported", evidenceRef: "sales:2026-07", simuladoLabel: SIMULADO },
  { period: "2026-08", amountArs: 3745800, status: "reported", evidenceRef: "sales:2026-08", simuladoLabel: SIMULADO }
]);

/** The next period the feed records (the real provider's `NEXT_SALES_PERIOD`): 2026-09, reported. */
const NEXT_SALES_PERIOD = Object.freeze({
  period: "2026-09",
  amountArs: 3860000,
  status: "reported",
  evidenceRef: "sales:2026-09",
  simuladoLabel: SIMULADO
});

/**
 * The reference the real API's sales feed knows (`sme:SYN-PH-0001` -> the synthetic
 * bakery) and the business id that resolves to the same series. Any other value has
 * no series, so the real API answers an EMPTY one and the application-scoped
 * assessment refuses it with `sales_evidence_missing`.
 */
const KNOWN_SME_REFERENCE = "sme:SYN-PH-0001";
const DEMO_BUSINESS_ID = "panaderia-horizonte";

/** Contract-shaped persisted assessment (strict `applicationAssessmentSchema` + provenance). */
const ASSESSMENT = Object.freeze({
  assessment: {
    assessmentId: "asm_stub_001",
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
    generatedAt: "2026-09-30T12:00:00.000Z",
    source: "simulated"
  },
  recordedAt: "2026-09-30T12:00:01.000Z"
});

/** Last submitted request; reset per test via `POST /__reset` for isolation. */
let currentRequest = null;

/** The PyME's own persisted company (`GET/POST /businesses`); reset per test. */
let currentBusiness = null;

/** The PyME's linked wallet (`GET/POST /profile/wallet`); reset per test. */
let currentWallet = { publicKey: null, frozen: false };

/** Whether the feed's next period has been recorded (`POST /businesses/:id/sales-periods`). */
let salesPeriodRecorded = false;

/** Last recorded human decision; reset per test via `POST /__reset` for isolation. */
let latestDecision = null;

/** applicationId -> the attempt (`handoffId`) that recorded its assessment. */
const recordedAssessments = new Map();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  // `Authorization` is required by the upload and business clients, which attach
  // the signed-in session's bearer token; without it their CORS preflight fails.
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

/** True when the request carries a non-empty `Authorization: Bearer <token>` header. */
function hasBearerToken(request) {
  const header = request.headers["authorization"];
  return typeof header === "string" && /^Bearer \S+$/.test(header);
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  });
  response.end(payload);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    request.on("error", reject);
  });
}

/** Boundary of a `multipart/form-data` body, or `null` when absent. */
function multipartBoundary(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  return match ? (match[1] ?? match[2]).trim() : null;
}

/** The whole request body as one buffer (no JSON parsing). */
function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

/**
 * Minimal `multipart/form-data` reader for `POST /storage/uploads`: it recovers
 * the `kind` field and the file's name, declared content type and byte size.
 * The body is read as `latin1` so string indices map 1:1 to bytes. This is a
 * test double, not a hardened parser — the web client re-validates nothing here.
 */
async function readMultipartUpload(request) {
  const boundary = multipartBoundary(request.headers["content-type"]);
  if (boundary === null) return null;

  const body = (await readRawBody(request)).toString("latin1");
  const fields = {};
  let file = null;
  for (const rawSegment of body.split(`--${boundary}`)) {
    const segment = rawSegment.startsWith("\r\n") ? rawSegment.slice(2) : rawSegment;
    const headerEnd = segment.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headerText = segment.slice(0, headerEnd);
    const nameMatch = /name="([^"]*)"/i.exec(headerText);
    if (!nameMatch) continue;

    let content = segment.slice(headerEnd + 4);
    if (content.endsWith("\r\n")) content = content.slice(0, -2);

    const filenameMatch = /filename="([^"]*)"/i.exec(headerText);
    if (filenameMatch) {
      const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(headerText);
      file = {
        fileName: filenameMatch[1],
        contentType: (typeMatch?.[1] ?? "application/octet-stream").trim(),
        size: Buffer.byteLength(content, "latin1")
      };
    } else {
      fields[nameMatch[1]] = content;
    }
  }
  return file === null ? null : { kind: fields["kind"] ?? "upload", ...file };
}

function recordedOutcome(applied) {
  return {
    outcome: "assessment_recorded",
    applicationState: "human_review",
    applied,
    correlationId: CORRELATION_ID,
    ...ASSESSMENT
  };
}

/** The series the feed serves: the historical periods, plus the next one once it has been recorded. */
function currentSalesPeriods() {
  return salesPeriodRecorded ? [...SALES_PERIODS, NEXT_SALES_PERIOD] : SALES_PERIODS;
}

/** The latest reported period of a series (`YYYY-MM` sorts lexicographically), or `null`. */
function latestReportedPeriod(periods) {
  let latest = null;
  for (const entry of periods) {
    if (entry.status !== "reported" || entry.amountArs === null) continue;
    if (latest === null || entry.period > latest.period) latest = entry;
  }
  return latest;
}

const SME_REQUEST_PATH = /^\/sme-requests\/([^/]+)$/;
const DECISION_PATH = /^\/application-reviews\/([^/]+)\/decisions$/;
const SALES_FEED_PATH = /^\/businesses\/([^/]+)\/sales-periods$/;
const ASSESSMENT_POST_PATH = /^\/application-reviews\/([^/]+)\/assessments$/;
const ASSESSMENT_READ_PATH = /^\/application-reviews\/([^/]+)\/assessment$/;

async function handle(request, response) {
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
  const { pathname } = url;

  if (request.method === "OPTIONS") {
    response.writeHead(204, CORS_HEADERS);
    response.end();
    return;
  }

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "POST" && pathname === "/__reset") {
    currentRequest = null;
    currentBusiness = null;
    currentWallet = { publicKey: null, frozen: false };
    salesPeriodRecorded = false;
    latestDecision = null;
    recordedAssessments.clear();
    resetCampaignFixtures();
    resetDistributionFixtures();
    resetAdminReviewFixtures();
    response.writeHead(204, CORS_HEADERS);
    response.end();
    return;
  }

  // The admin review console (#410 / U7): queue, review context, verdicts, the
  // decision for its own application, the vault deployment and private document reads.
  if (
    await tryHandleAdminReviewRequest(request, response, request.method, pathname, url, {
      sendJson,
      readJsonBody,
      corsHeaders: CORS_HEADERS
    })
  ) {
    return;
  }

  const smeReadMatch = SME_REQUEST_PATH.exec(pathname);
  if (request.method === "GET" && smeReadMatch) {
    if (currentRequest === null || decodeURIComponent(smeReadMatch[1]) !== APPLICATION_ID) {
      sendJson(response, 404, { code: "not_found" });
      return;
    }
    // Like the real API: a reference the feed does not know has an EMPTY series.
    const salesPeriods = currentRequest.smeReference === KNOWN_SME_REFERENCE ? currentSalesPeriods() : [];
    sendJson(response, 200, { request: currentRequest, salesPeriods });
    return;
  }

  // The monthly sales feed (the real `SalesDataProviderPort` routes). Both the
  // business id and the synthetic SME reference resolve to the one demo series.
  const salesFeedMatch = SALES_FEED_PATH.exec(pathname);
  if (salesFeedMatch) {
    const identifier = decodeURIComponent(salesFeedMatch[1]);
    const known = identifier === DEMO_BUSINESS_ID || identifier === KNOWN_SME_REFERENCE;

    if (request.method === "GET") {
      if (!known) {
        sendJson(response, 404, { code: "not_found" });
        return;
      }
      sendJson(response, 200, { businessId: identifier, periods: currentSalesPeriods() });
      return;
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request);
      // The record-next body must be exactly `{}`, like the real route: extra keys
      // or a missing body are a 400 before the provider is ever consulted.
      if (typeof body !== "object" || body === null || Array.isArray(body) || Object.keys(body).length !== 0) {
        sendJson(response, 400, { code: "invalid_request" });
        return;
      }
      if (!known) {
        sendJson(response, 404, { code: "not_found" });
        return;
      }
      // Idempotent, like the real provider: the first call applies the period and
      // every later call returns the identical period with `applied: false`.
      const applied = !salesPeriodRecorded;
      salesPeriodRecorded = true;
      sendJson(response, applied ? 201 : 200, { applied, period: NEXT_SALES_PERIOD });
      return;
    }
  }

  // API-mediated upload (`T4c`): the browser posts multipart `kind` + `file`
  // and receives the stored object's descriptor. The bytes are not persisted —
  // only the shape the web client parses is echoed back.
  if (request.method === "POST" && pathname === "/storage/uploads") {
    const upload = await readMultipartUpload(request);
    if (upload === null || upload.fileName.length === 0) {
      sendJson(response, 400, { code: "invalid_request" });
      return;
    }
    sendJson(response, 201, {
      path: `${upload.kind}/${upload.fileName}`,
      name: upload.fileName,
      size: upload.size,
      contentType: upload.contentType
    });
    return;
  }

  // The PyME's own company (`T3c`). Like the real API, the owner is resolved
  // from the session (ignored here) and a missing company is a truthful 404, so
  // `ensureMyBusiness` creates exactly one.
  if (request.method === "GET" && pathname === "/businesses/mine") {
    if (currentBusiness === null) {
      sendJson(response, 404, { code: "not_found" });
      return;
    }
    sendJson(response, 200, { business: currentBusiness });
    return;
  }

  if (request.method === "POST" && pathname === "/businesses") {
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      sendJson(response, 400, { code: "invalid_request" });
      return;
    }
    // Mirrors the API (#410/U13): an optional campaign duration of exactly 30,
    // 60 or 90 days; anything else is the sanitized field error.
    const duration = body.campaignDurationDays;
    if (duration !== undefined && duration !== null && ![30, 60, 90].includes(duration)) {
      sendJson(response, 400, { errors: [{ field: "campaignDurationDays", code: "invalid" }] });
      return;
    }
    currentBusiness = {
      businessId: BUSINESS_ID,
      ownerUserId: OWNER_USER_ID,
      name: String(body.name ?? ""),
      cuit: String(body.cuit ?? ""),
      sector: String(body.sector ?? ""),
      city: String(body.city ?? ""),
      description: String(body.description ?? ""),
      goalArs: Number(body.goalArs ?? 0),
      revenueShare: Number(body.revenueShare ?? 0),
      ...(duration === undefined || duration === null ? {} : { campaignDurationDays: duration }),
      createdAt: BUSINESS_CREATED_AT,
      updatedAt: BUSINESS_CREATED_AT
    };
    sendJson(response, 201, { business: currentBusiness });
    return;
  }

  // The PyME wallet connection (`T1c`). Like the real API, the owner comes from
  // the session (ignored here), the challenge is single-use, and the submitted
  // public key is verified and stored — the stub echoes it without verification.
  if (request.method === "POST" && pathname === "/profile/wallet/challenge") {
    sendJson(response, 201, { challengeId: WALLET_CHALLENGE_ID, message: WALLET_CHALLENGE_MESSAGE });
    return;
  }

  if (request.method === "POST" && pathname === "/profile/wallet") {
    const body = await readJsonBody(request);
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      typeof body.challengeId !== "string" ||
      typeof body.publicKey !== "string" ||
      typeof body.signature !== "string"
    ) {
      sendJson(response, 400, { code: "invalid_request" });
      return;
    }
    currentWallet = { publicKey: body.publicKey, frozen: false };
    sendJson(response, 200, { publicKey: currentWallet.publicKey, frozen: currentWallet.frozen });
    return;
  }

  if (request.method === "GET" && pathname === "/profile/wallet") {
    sendJson(response, 200, { publicKey: currentWallet.publicKey, frozen: currentWallet.frozen });
    return;
  }

  // Test-only seed: an application that already has a recorded assessment (the approval
  // step is exercised directly, with no request submitted first).
  if (request.method === "POST" && pathname === "/__seed-assessment") {
    const body = await readJsonBody(request);
    recordedAssessments.set(body?.applicationId ?? APPLICATION_ID, "seeded");
    response.writeHead(204, CORS_HEADERS);
    response.end();
    return;
  }

  const assessmentPostMatch = ASSESSMENT_POST_PATH.exec(pathname);
  if (request.method === "POST" && assessmentPostMatch) {
    const applicationId = decodeURIComponent(assessmentPostMatch[1]);
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || typeof body.handoffId !== "string") {
      sendJson(response, 400, { code: "invalid_request" });
      return;
    }
    if (currentRequest === null || applicationId !== APPLICATION_ID) {
      sendJson(response, 404, { code: "not_found" });
      return;
    }
    const existing = recordedAssessments.get(applicationId);
    if (existing !== undefined) {
      if (existing !== body.handoffId) {
        sendJson(response, 409, { code: "correlation_conflict" });
        return;
      }
      sendJson(response, 200, recordedOutcome(false));
      return;
    }
    if (currentRequest.smeReference !== KNOWN_SME_REFERENCE) {
      sendJson(response, 409, { code: "sales_evidence_missing" });
      return;
    }
    recordedAssessments.set(applicationId, body.handoffId);
    sendJson(response, 201, recordedOutcome(true));
    return;
  }

  const assessmentReadMatch = ASSESSMENT_READ_PATH.exec(pathname);
  if (request.method === "GET" && assessmentReadMatch) {
    if (!recordedAssessments.has(decodeURIComponent(assessmentReadMatch[1]))) {
      sendJson(response, 404, { code: "not_found" });
      return;
    }
    sendJson(response, 200, ASSESSMENT);
    return;
  }

  if (request.method === "POST" && pathname === "/sme-requests") {
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      sendJson(response, 400, { errors: [{ field: "body", code: "invalid_shape" }] });
      return;
    }
    // The real API serves this route to an authenticated `PYME` only
    // (`route-policy.ts`), so the wizard's send must carry the session's Bearer
    // token: without it the U9 live rehearsal got 401. The retiring scripted
    // journey (`/request`, synthetic `sme:SYN-` references, #438) never signs in
    // and stays exempt here until its routes are removed.
    const scriptedJourney = typeof body.smeReference === "string" && body.smeReference.startsWith("sme:SYN-");
    if (!scriptedJourney && !hasBearerToken(request)) {
      sendJson(response, 401, { code: "unauthorized" });
      return;
    }
    currentRequest = body;
    sendJson(response, 201, { applicationId: APPLICATION_ID, request: body });
    return;
  }

  const decisionMatch = DECISION_PATH.exec(pathname);
  if (request.method === "POST" && decisionMatch) {
    const applicationId = decodeURIComponent(decisionMatch[1]);
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      sendJson(response, 400, { errors: [{ field: "body", code: "invalid_shape" }] });
      return;
    }
    // The gateway sends the command without `applicationId` (it travels in the path);
    // the record the UI renders carries it back, exactly like the real API would. It
    // is kept so the evidence step can read the same decision back.
    const decision = { ...body, applicationId, decidedAt: DECIDED_AT, correlationId: CORRELATION_ID };
    latestDecision = decision;
    sendJson(response, 201, { applied: true, decision });
    return;
  }

  if (request.method === "GET" && decisionMatch) {
    const applicationId = decodeURIComponent(decisionMatch[1]);
    if (latestDecision === null || latestDecision.applicationId !== applicationId) {
      // The API's truthful `not_found`: nothing recorded yet, never an empty success.
      sendJson(response, 404, { code: "not_found" });
      return;
    }
    sendJson(response, 200, { decision: latestDecision });
    return;
  }

  if (pathname === "/campaigns" || pathname.startsWith("/campaigns/")) {
    const handled = await tryHandleCampaignRequest(request, response, request.method, pathname, url, {
      sendJson,
      readJsonBody
    });
    if (handled) return;
  }

  if (pathname === "/revenue-share-distributions" || pathname.startsWith("/revenue-share-distributions/")) {
    const handled = await tryHandleDistributionRequest(request, response, request.method, pathname, {
      sendJson,
      readJsonBody,
      // The derivation reads the SME's feed, exactly like the real API: the latest
      // reported period (2026-08, or 2026-09 once it has been recorded).
      latestReportedSalesPeriod: () => latestReportedPeriod(currentSalesPeriods())
    });
    if (handled) return;
  }

  sendJson(response, 404, { code: "not_found" });
}

createServer((request, response) => {
  handle(request, response).catch(() => {
    if (!response.headersSent) sendJson(response, 500, { code: "stub_error" });
    else response.end();
  });
}).listen(PORT, HOST, () => {
  process.stdout.write(`stub-api listening on http://${HOST}:${PORT}\n`);
});

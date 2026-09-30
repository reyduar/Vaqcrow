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

const HOST = "127.0.0.1";
const PORT = Number(process.env["STUB_API_PORT"] ?? 4310);

const SIMULADO = "SIMULADO";

/** Frozen server-side literals so assertions never race a real clock or RNG. */
const DECIDED_AT = "2026-09-19T12:00:00-03:00";
const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const CORRELATION_ID = "11111111-2222-4333-8444-555555555555";

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

/**
 * The reference the real API's sales feed knows (`sme:SYN-PH-0001` -> the synthetic
 * bakery). Any other reference has no series, so the real API answers an EMPTY one
 * and the application-scoped assessment refuses it with `sales_evidence_missing`.
 */
const KNOWN_SME_REFERENCE = "sme:SYN-PH-0001";

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

/** applicationId -> the attempt (`handoffId`) that recorded its assessment. */
const recordedAssessments = new Map();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

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

function recordedOutcome(applied) {
  return {
    outcome: "assessment_recorded",
    applicationState: "human_review",
    applied,
    correlationId: CORRELATION_ID,
    ...ASSESSMENT
  };
}

const SME_REQUEST_PATH = /^\/sme-requests\/([^/]+)$/;
const DECISION_PATH = /^\/application-reviews\/([^/]+)\/decisions$/;
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
    recordedAssessments.clear();
    resetCampaignFixtures();
    response.writeHead(204, CORS_HEADERS);
    response.end();
    return;
  }

  const smeReadMatch = SME_REQUEST_PATH.exec(pathname);
  if (request.method === "GET" && smeReadMatch) {
    if (currentRequest === null || decodeURIComponent(smeReadMatch[1]) !== APPLICATION_ID) {
      sendJson(response, 404, { code: "not_found" });
      return;
    }
    // Like the real API: a reference the feed does not know has an EMPTY series.
    const salesPeriods = currentRequest.smeReference === KNOWN_SME_REFERENCE ? SALES_PERIODS : [];
    sendJson(response, 200, { request: currentRequest, salesPeriods });
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
    // the record the UI renders carries it back, exactly like the real API would.
    sendJson(response, 201, {
      applied: true,
      decision: { ...body, applicationId, decidedAt: DECIDED_AT, correlationId: CORRELATION_ID }
    });
    return;
  }

  if (pathname === "/campaigns" || pathname.startsWith("/campaigns/")) {
    const handled = await tryHandleCampaignRequest(request, response, request.method, pathname, url, {
      sendJson,
      readJsonBody
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

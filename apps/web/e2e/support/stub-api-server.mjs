#!/usr/bin/env node
/**
 * Deterministic local double for the demo's HTTP contracts (issue #47).
 *
 * `apps/web` talks to the future `apps/api` over the paths documented in
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

const HOST = "127.0.0.1";
const PORT = Number(process.env["STUB_API_PORT"] ?? 4310);

const SIMULADO = "SIMULADO";

/** Frozen server-side literals so assertions never race a real clock or RNG. */
const DECIDED_AT = "2026-09-19T12:00:00-03:00";
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

/** Last submitted request; reset per test via `POST /__reset` for isolation. */
let currentRequest = null;

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

const DECISION_PATH = /^\/application-reviews\/([^/]+)\/decisions$/;

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
    response.writeHead(204, CORS_HEADERS);
    response.end();
    return;
  }

  if (request.method === "GET" && pathname === "/sme-requests/current") {
    sendJson(response, 200, { request: currentRequest, salesPeriods: SALES_PERIODS });
    return;
  }

  if (request.method === "POST" && pathname === "/sme-requests") {
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      sendJson(response, 400, { errors: [{ field: "body", code: "invalid_shape" }] });
      return;
    }
    currentRequest = body;
    sendJson(response, 201, body);
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

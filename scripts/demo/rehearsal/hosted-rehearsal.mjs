#!/usr/bin/env node
/**
 * Hosted end-to-end rehearsal of the Vaqcrow role flow (API level, no browser).
 *
 * Brooks the exact route contract the deployed stack serves — the hosted
 * Railway API, the remote Supabase project (Auth + Storage + Postgres) and
 * Stellar Testnet — by driving one full journey:
 *
 *   ADMIN   rate table (create v1 when empty)
 *   PYME    signup (GoTrue) -> admin-confirm -> password grant
 *           wallet challenge -> SEP-53 sign -> link
 *           business -> three mandatory uploads + one photo
 *           completeness check (advisory) -> submit to review
 *   ADMIN   review context -> per-document verdict -> approved decision
 *           deployment confirmed -> campaign id
 *   INVESTOR signup/confirm -> Testnet fund -> wallet link
 *           contribute -> sign XDR in-process -> submit -> observe tx
 *
 * It mirrors `apps/web/e2e-live/admin-review.live.spec.ts` (the U9 live
 * harness) at the API level: the same real routes, signing with
 * `@stellar/stellar-sdk` in this process instead of through Freighter.
 *
 * Contract and honesty rules:
 *   - Fresh records per run; nothing is reset (Option A).
 *   - Real Testnet (no economic value), remote Supabase, non-production.
 *   - `.env.cloud` is NEVER read directly — it is loaded by Node's
 *     `--env-file` flag. No secret, token or password is ever printed.
 *   - The `@stellar/stellar-sdk` is resolved through the API workspace's own
 *     resolution (a `createRequire` anchored at apps/api/package.json), so the
 *     script runs from any cwd without a root install.
 *
 * Run (from the repository root or apps/api):
 *   node --env-file=../../.env.cloud scripts/demo/rehearsal/hosted-rehearsal.mjs
 *
 * Recognised env (all from `.env.cloud`, all optional except the Supabase ones):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 *   SUPABASE_SERVICE_ROLE_KEY, VAQCROW_SUPERADMIN_EMAIL,
 *   VAQCROW_SUPERADMIN_PASSWORD, HOSTED_API_BASE_URL (override).
 */

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

// --- SDK resolution ---------------------------------------------------------
// The script lives outside the API workspace, so a bare `import
// "@stellar/stellar-sdk"` would not resolve. Anchor a CommonJS require at the
// API workspace's own package.json: Node walks up from there into
// apps/api/node_modules and finds the pinned 17.1.0 build.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiRequire = createRequire(path.resolve(scriptDir, "../../../apps/api/package.json"));
const { Keypair, TransactionBuilder } = apiRequire("@stellar/stellar-sdk");

// --- Configuration (values are never printed) -------------------------------
const API_BASE = (process.env.HOSTED_API_BASE_URL ?? "https://api-production-c07f.up.railway.app").replace(/\/+$/, "");
const HORIZON_URL = (process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org").replace(/\/+$/, "");
const FRIENDBOT_URL = (process.env.STELLAR_FRIENDBOT_URL ?? "https://friendbot.stellar.org").replace(/\/+$/, "");

function required(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Missing required env var ${name}. Load the cloud profile through Node's flag, e.g. ` +
        `--env-file=../../.env.cloud (the file is never read or printed directly).`
    );
  }
  return value.trim();
}

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
const PUBLISHABLE_KEY = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = required("VAQCROW_SUPERADMIN_EMAIL");
const ADMIN_PASSWORD = required("VAQCROW_SUPERADMIN_PASSWORD");

// --- Rehearsal constants ----------------------------------------------------
const runId = randomUUID().slice(0, 8);
const DAY_MS = 86_400_000;
const DEMO_GOAL_ARS = 15_000_000; // 15,000 USD at 1 USD = 1,000 ARS (< the 50,000 USD cap)
const REVENUE_SHARE = 5; // percent, within [1, 10]
const CAMPAIGN_DURATION_DAYS = 90; // must be exactly 30, 60 or 90
const RATE_SCALE = 1_000_000n; // campaign-guardrails RATE_SCALE, duplicated literally
const STROOPS_PER_XLM = 10_000_000n;

// --- Tiny logging / redaction ----------------------------------------------
function step(message) {
  console.log(`[reh] step: ${message}`);
}
function note(message) {
  console.log(`[reh] ${message}`);
}

/**
 * Best-effort redaction for anything logged. The API only ever answers with a
 * sanitized `{ code }` / `{ errors }`, but a token or XDR must never leak even
 * if an unexpected body shows up.
 */
function redact(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    if (/token|password|secret|authorization|sig(nature)?|xdr/i.test(key)) {
      out[key] = "<redacted>";
    } else {
      out[key] = redact(inner);
    }
  }
  return out;
}

function brief(body) {
  try {
    return JSON.stringify(redact(body));
  } catch {
    return "<unprintable>";
  }
}

class RehearsalError extends Error {}

/** Asserts an HTTP status, in the `HTTP <status> <sanitized body>` shape. */
function expect(response, codes, label) {
  const wanted = Array.isArray(codes) ? codes : [codes];
  if (!wanted.includes(response.status)) {
    throw new RehearsalError(`${label} -> HTTP ${response.status} ${brief(response.body)}`);
  }
  return response;
}

// --- HTTP helpers -----------------------------------------------------------
async function parse(response) {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function api(token, method, route, body) {
  const response = await fetch(`${API_BASE}${route}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await parse(response) };
}

async function uploadDocument(token, kind, filename, bytes, contentType) {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", new Blob([bytes], { type: contentType }), filename);
  const response = await fetch(`${API_BASE}/storage/uploads`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form
  });
  return { status: response.status, body: await parse(response) };
}

// --- GoTrue / Supabase Admin ------------------------------------------------
async function gotrue(route, body, extraHeaders = {}) {
  const response = await fetch(`${SUPABASE_URL}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: PUBLISHABLE_KEY, ...extraHeaders },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await parse(response) };
}

function adminHeaders() {
  return {
    "content-type": "application/json",
    apikey: SERVICE_ROLE_KEY,
    authorization: `Bearer ${SERVICE_ROLE_KEY}`
  };
}

/** Creates a confirmed account and returns its access token (kept in memory only). */
async function createConfirmedAccount(role, displayName) {
  const email = `${role.toLowerCase()}.reh.${runId}@example.test`;
  const password = `Rehearsal-${runId}-${randomUUID().slice(0, 8)}!`;

  const signup = await gotrue("/auth/v1/signup", { email, password, data: { role, display_name: displayName } });
  if (signup.status !== 200 && signup.status !== 201) {
    throw new RehearsalError(`GoTrue signup (${role}) -> HTTP ${signup.status} ${brief(signup.body)}`);
  }
  const userId = signup.body?.id ?? signup.body?.user?.id;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new RehearsalError(`GoTrue signup (${role}) returned no user id`);
  }

  // Cloud has no Mailpit: confirm through the Admin API instead of a link.
  const confirm = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify({ email_confirm: true })
  });
  if (confirm.status !== 200) {
    const body = await parse(confirm);
    throw new RehearsalError(`Admin confirm (${role}) -> HTTP ${confirm.status} ${brief(body)}`);
  }

  const grant = await gotrue("/auth/v1/token?grant_type=password", { email, password });
  if (grant.status !== 200 || typeof grant.body?.access_token !== "string") {
    throw new RehearsalError(`Password grant (${role}) -> HTTP ${grant.status} ${brief(grant.body)}`);
  }
  return { email, password, userId, token: grant.body.access_token };
}

// --- Stellar helpers --------------------------------------------------------
async function accountExists(publicKey) {
  const response = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
  if (response.status === 404) return false;
  if (!response.ok) throw new RehearsalError(`Horizon account read -> HTTP ${response.status}`);
  return true;
}

/** Funds a fresh Testnet account; skips when it already exists (the platform creates the SME's). */
async function fundIfMissing(publicKey, label) {
  if (await accountExists(publicKey)) {
    note(`fund: ${label} account already exists on Testnet — skipping friendbot`);
    return false;
  }
  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (!response.ok) {
    throw new RehearsalError(`Friendbot ${label} -> HTTP ${response.status} ${brief(await parse(response))}`);
  }
  return true;
}

/** Links a wallet: challenge -> SEP-53 sign the message verbatim -> submit. */
async function linkWallet(token, keypair, label) {
  const challenge = expect(await api(token, "POST", "/profile/wallet/challenge"), 201, `${label} wallet challenge`);
  const challengeId = challenge.body?.challengeId;
  const message = challenge.body?.message;
  if (typeof challengeId !== "string" || typeof message !== "string") {
    throw new RehearsalError(`${label} wallet challenge returned no challengeId/message`);
  }
  // `signMessage` returns a plain Uint8Array (not a Buffer), so wrap it before
  // base64: `Uint8Array.prototype.toString("base64")` ignores its argument and
  // yields a comma-separated byte list, which the API correctly rejects.
  const signature = Buffer.from(keypair.signMessage(message)).toString("base64");
  expect(
    await api(token, "POST", "/profile/wallet", { challengeId, publicKey: keypair.publicKey(), signature }),
    200,
    `${label} wallet link`
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil(description, fn, done, { timeoutMs = 180_000, intervalMs = 3_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  for (;;) {
    last = await fn();
    if (done(last)) return last;
    if (Date.now() >= deadline) {
      throw new RehearsalError(`timed out waiting for ${description} (last: ${brief(last)})`);
    }
    await sleep(intervalMs);
  }
}

// --- Synthetic files (structurally valid, synthetic demo data) --------------
function syntheticPdf(lines) {
  const escape = (text) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = [
    "BT",
    "/F1 14 Tf",
    "72 760 Td",
    "18 TL",
    ...lines.map((line, index) => `${index === 0 ? "" : "T* "}(${escape(line)}) Tj`),
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${String(Buffer.byteLength(content, "latin1"))} >>\nstream\n${content}\nendstream`
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function syntheticPng(width = 64, height = 48) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const inside = x > 12 && x < width - 12 && y > 12 && y < height - 12;
      const [r, g, b] = inside ? [196, 132, 64] : [240, 236, 228];
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

// --- The rehearsal ----------------------------------------------------------
const facts = { runId, apiBase: API_BASE };

function record(key, value) {
  facts[key] = value;
  note(`${key}: ${typeof value === "string" ? value : brief(value)}`);
}

async function main() {
  note(`API base: ${API_BASE} | network: Testnet | run: ${runId}`);
  note(`goal: ${DEMO_GOAL_ARS} ARS | revenueShare: ${REVENUE_SHARE}% | duration: ${CAMPAIGN_DURATION_DAYS}d`);

  // Identity generated once; the SME key is the vault's immutable destination.
  const smeKeypair = Keypair.random();
  record("smePublicKey", smeKeypair.publicKey());

  step("0 · ADMIN sign-in and active ARS/USD rate");
  const admin = await signInExisting(ADMIN_EMAIL, ADMIN_PASSWORD, "ADMIN");
  const adminToken = admin.token;
  let rate = (await api(adminToken, "GET", "/admin/rates/current")).body?.rate;
  if (!rate) {
    const created = expect(
      await api(adminToken, "POST", "/admin/rates", {
        version: 1,
        effectiveAt: new Date(Date.now() - 60_000).toISOString(),
        source: "manual",
        usdToArs: (1000n * RATE_SCALE).toString(),
        stroopsPerUsd: "10000000"
      }),
      201,
      "POST /admin/rates"
    );
    rate = created.body?.rate;
  }
  if (!rate) throw new RehearsalError("no active rate after GET/POST /admin/rates");
  record("rate", { version: rate.version, source: rate.source, usdToArs: rate.usdToArs, stroopsPerUsd: rate.stroopsPerUsd });

  step("1 · PYME account: signup -> admin confirm -> password grant");
  const pyme = await createConfirmedAccount("PYME", `PyME Ensayo ${runId}`);
  const pymeToken = pyme.token;

  step("2 · PYME wallet: challenge -> SEP-53 sign -> link");
  await linkWallet(pymeToken, smeKeypair, "PYME");

  step("3 · PYME business (POST /businesses)");
  const business = expect(
    await api(pymeToken, "POST", "/businesses", {
      name: `Panadería Ensayo ${runId}`,
      cuit: "30712345678",
      sector: "Alimentos",
      city: "Córdoba",
      description: "Panadería artesanal sintética de demo Vaqcrow (ensayo hosted).",
      goalArs: DEMO_GOAL_ARS,
      revenueShare: REVENUE_SHARE,
      campaignDurationDays: CAMPAIGN_DURATION_DAYS
    }),
    201,
    "POST /businesses"
  );
  record("businessName", business.body?.business?.name ?? "?");

  step("4 · PYME uploads: three mandatory documents + one photo");
  const mandatory = [
    { kind: "sales-declarations", title: "Declaraciones de ventas" },
    { kind: "cuit", title: "Constancia de CUIT" },
    { kind: "articles-of-incorporation", title: "Estatuto" }
  ];
  for (const { kind, title } of mandatory) {
    const bytes = syntheticPdf([
      `${title} - Panadería Ensayo ${runId}`,
      "CUIT 30-71234567-8 - Córdoba, Argentina",
      "DOCUMENTO SINTÉTICO DE DEMO - sin validez legal",
      "Generado por el ensayo hosted de Vaqcrow (Testnet)."
    ]);
    expect(
      await uploadDocument(pymeToken, kind, `${kind}-sintetico.pdf`, bytes, "application/pdf"),
      201,
      `upload ${kind}`
    );
  }
  expect(
    await uploadDocument(pymeToken, "photo", "foto-sintetica.png", syntheticPng(), "image/png"),
    201,
    "upload photo"
  );
  record("uploads", { documents: 3, photos: 1 });

  step("5 · PYME completeness check (advisory, warns only)");
  const salesMonths = [
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08"
  ].map((month) => ({ month, valueArs: 2_000_000 }));
  const completeness = await api(pymeToken, "POST", "/completeness-check", {
    documents: [
      { kind: "sales-declarations", present: true },
      { kind: "cuit", present: true },
      { kind: "articles-of-incorporation", present: true }
    ],
    photoCount: 1,
    salesMonths
  });
  if (completeness.status !== 200) {
    // Advisory only: a malformed/failed check never blocks the send.
    note(`completeness check returned HTTP ${completeness.status} ${brief(completeness.body)} — continuing (advisory)`);
    record("completeness", { status: completeness.status });
  } else {
    record("completeness", {
      complete: completeness.body?.result?.complete,
      findings: (completeness.body?.result?.findings ?? []).map((f) => f.code)
    });
  }

  step("6 · PYME submit to review (POST /sme-requests)");
  const submission = expect(
    await api(pymeToken, "POST", "/sme-requests", {
      smeReference: `REH-${runId}`,
      declaredTotalArs: DEMO_GOAL_ARS,
      periodStart: "2026-01",
      periodEnd: "2026-08",
      simuladoLabel: "SIMULADO"
    }),
    201,
    "POST /sme-requests"
  );
  const applicationId = submission.body?.applicationId;
  if (typeof applicationId !== "string" || applicationId.length === 0) {
    throw new RehearsalError("POST /sme-requests returned no applicationId");
  }
  record("applicationId", applicationId);

  step("7 · ADMIN review: wait for human_review, verdict, approve with limit");
  // The submission starts the advisory assessment in the background (U12); it
  // moves the review to `human_review`. Bounded fallback: if it stalls, retry
  // the explicit assessment route once (it is the documented retry surface).
  const reviewDeadline = Date.now() + 180_000;
  let reviewFallbackTried = false;
  let context;
  for (;;) {
    const read = await api(adminToken, "GET", `/application-reviews/${applicationId}/context`);
    if (read.status !== 200) {
      throw new RehearsalError(`GET review context -> HTTP ${read.status} ${brief(read.body)}`);
    }
    context = read.body;
    const state = context?.applicationReview?.state;
    if (state !== undefined && state !== "awaiting_assessment") break;
    if (!reviewFallbackTried && Date.now() > reviewDeadline - 90_000) {
      reviewFallbackTried = true;
      const retry = await api(adminToken, "POST", `/application-reviews/${applicationId}/assessments`, {
        handoffId: randomUUID()
      });
      note(`assessment retry -> HTTP ${retry.status} ${brief(retry.body)}`);
    }
    if (Date.now() >= reviewDeadline) {
      throw new RehearsalError(`application ${applicationId} never left awaiting_assessment`);
    }
    await sleep(4_000);
  }
  if (context.applicationReview.state === "awaiting_assessment") {
    throw new RehearsalError("assessment never completed");
  }
  note(`review state: ${context.applicationReview.state}`);
  const cuitDocument = (context.documents ?? []).find((document) => document.kind === "cuit");
  if (!cuitDocument) throw new RehearsalError("review context carries no CUIT document");
  expect(
    await api(adminToken, "PUT", `/application-reviews/${applicationId}/documents/${cuitDocument.documentId}/verdict`, {
      verdict: "valid"
    }),
    200,
    "PUT document verdict"
  );
  record("documentVerdict", { documentId: cuitDocument.documentId, verdict: "valid" });

  const decision = expect(
    await api(adminToken, "POST", `/application-reviews/${applicationId}/decisions`, {
      decisionId: randomUUID(),
      outcome: "approved",
      reason: `Ensayo hosted ${runId}: documentación sintética revisada contra Testnet.`,
      approvedLimitArs: DEMO_GOAL_ARS
    }),
    201,
    "POST decision"
  );
  record("decision", { applied: decision.body?.applied, outcome: decision.body?.decision?.outcome });

  step("8 · ADMIN deployment: poll until confirmed");
  const deploymentRoute = `/application-reviews/${applicationId}/deployment`;
  let triggered = false;
  const deployment = await pollUntil(
    `deployment of ${applicationId} to confirm`,
    async () => {
      const read = await api(adminToken, "GET", deploymentRoute);
      if (read.status === 200) {
        const state = read.body?.deployment?.state;
        // A failed/stale attempt is retryable: ask the API to try again.
        if (!triggered && (state === "failed" || read.body?.deployment?.retryable === true)) {
          triggered = true;
          await api(adminToken, "POST", deploymentRoute); // 409 deployment_in_progress is fine
        }
        return read.body;
      }
      if (read.status === 404 && !triggered) {
        triggered = true;
        await api(adminToken, "POST", deploymentRoute);
        return { deployment: { state: "triggered" } };
      }
      return read.body;
    },
    (body) => body?.deployment?.state === "confirmed" || body?.deployment?.state === "failed",
    { timeoutMs: 240_000, intervalMs: 5_000 }
  );
  if (deployment?.deployment?.state !== "confirmed") {
    throw new RehearsalError(`deployment did not confirm: ${brief(deployment)}`);
  }
  const campaignId = deployment.deployment.campaignId;
  if (typeof campaignId !== "string" || campaignId.length === 0) {
    throw new RehearsalError("confirmed deployment carries no campaignId");
  }
  record("deployment", { state: "confirmed", attempts: deployment.deployment.attempts });
  record("campaignId", campaignId);

  step("9 · campaign read: contract address and on-chain goal");
  const campaign = expect(await api(adminToken, "GET", `/campaigns/${campaignId}`), 200, "GET /campaigns/:id");
  const contractAddress = campaign.body?.campaign?.contractAddress;
  const goalStroops = BigInt(campaign.body?.campaign?.goalStroops ?? "0");
  record("contractAddress", contractAddress);
  record("campaignState", campaign.body?.campaign?.state);
  record("goalStroops", goalStroops.toString());
  record("smeAccountId", campaign.body?.campaign?.smeAccountId);
  if (campaign.body?.campaign?.smeAccountId !== smeKeypair.publicKey()) {
    throw new RehearsalError("campaign smeAccountId does not match the linked PyME wallet");
  }

  step("10 · INVESTOR: account, Testnet funding, wallet link");
  const investor = await createConfirmedAccount("INVERSOR", `Inversor Ensayo ${runId}`);
  const investorKeypair = Keypair.random();
  record("investorPublicKey", investorKeypair.publicKey());
  await fundIfMissing(investorKeypair.publicKey(), "investor");
  await fundIfMissing(smeKeypair.publicKey(), "SME");
  await linkWallet(investor.token, investorKeypair, "INVERSOR");

  step("11 · INVESTOR contributes: prepare -> sign XDR -> submit -> observe");
  const capStroops = goalStroops / 10n; // <= the vault's per-investor cap (goal/10)
  const amountStroops = capStroops;
  record("contributionStroops", amountStroops.toString());
  const prepared = expect(
    await api(investor.token, "POST", `/campaigns/${campaignId}/invocations`, {
      operation: "contribute",
      investorAccountId: investorKeypair.publicKey(),
      sourceAccountId: null,
      amountStroops: amountStroops.toString()
    }),
    200,
    "POST /invocations"
  );
  const invocation = prepared.body?.contractInvocation;
  if (!invocation?.xdr || !invocation?.networkPassphrase) {
    throw new RehearsalError("prepare returned no contractInvocation xdr/networkPassphrase");
  }
  const transaction = TransactionBuilder.fromXDR(invocation.xdr, invocation.networkPassphrase);
  transaction.sign(investorKeypair);
  const submitted = expect(
    await api(investor.token, "POST", `/campaigns/${campaignId}/invocations/submission`, {
      operation: "contribute",
      investorAccountId: investorKeypair.publicKey(),
      sourceAccountId: null,
      amountStroops: amountStroops.toString(),
      signedXdr: transaction.toXDR()
    }),
    202,
    "POST /invocations/submission"
  );
  const hash = submitted.body?.transactionHash;
  if (typeof hash !== "string" || hash.length === 0) {
    throw new RehearsalError("submission returned no transactionHash");
  }
  const outcome = await pollUntil(
    `contribution ${hash} to leave pending`,
    async () =>
      (
        await api(
          investor.token,
          "GET",
          `/campaigns/${campaignId}/transactions/${hash}?investor=${encodeURIComponent(investorKeypair.publicKey())}`
        )
      ).body,
    (body) => body?.status !== "pending" && body?.status !== undefined,
    { timeoutMs: 90_000, intervalMs: 3_000 }
  );
  record("contributionTxHash", hash);
  record("contributionStatus", outcome?.status);
  if (outcome?.status !== "success") {
    throw new RehearsalError(`contribution ${hash} did not succeed: ${brief(outcome)}`);
  }

  step("12 · campaign mirror reflects the contribution");
  const after = await pollUntil(
    "campaign total to include the contribution",
    async () => (await api(investor.token, "GET", `/campaigns/${campaignId}`)).body?.campaign,
    (mirror) => mirror !== undefined && BigInt(mirror.totalStroops) >= amountStroops,
    { timeoutMs: 60_000, intervalMs: 3_000 }
  );
  record("campaignTotalStroops", after.totalStroops);

  return 0;
}

/**
 * Sign-in for an already-seeded account (the superadmin). The same shape as a
 * created account, but without signup/confirm — the seeded profile already
 * exists and the DB trigger gave it its role.
 */
async function signInExisting(email, password, role) {
  const grant = await gotrue("/auth/v1/token?grant_type=password", { email, password });
  if (grant.status !== 200 || typeof grant.body?.access_token !== "string") {
    throw new RehearsalError(`Password grant (${role}) -> HTTP ${grant.status} ${brief(grant.body)}`);
  }
  return { email, token: grant.body.access_token };
}

main()
  .then(() => {
    console.log(`[reh] FACTS ${brief(facts)}`);
    process.exitCode = 0;
  })
  .catch((error) => {
    if (error instanceof RehearsalError) {
      console.error(`[reh] FAILED: ${error.message}`);
    } else {
      console.error(`[reh] FAILED (unexpected): ${error instanceof Error ? error.stack : String(error)}`);
    }
    console.log(`[reh] FACTS ${brief(facts)}`);
    process.exitCode = 1;
  });

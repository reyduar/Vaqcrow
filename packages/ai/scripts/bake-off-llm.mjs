#!/usr/bin/env node
/**
 * LLM bake-off — a MEASUREMENT tool that runs the PRODUCTION path.
 *
 * It answers one question with evidence instead of reputation: which model, on
 * this task, returns an assessment the real contract accepts, citing only the
 * evidence it was given, fast enough for a live demo.
 *
 * It calls the same adapter the application calls, with the same prompt and the
 * same validation, so a candidate cannot pass here and fail in the app — and
 * running it is also the live verification of the adapter itself. It varies only
 * the model, which is the one thing the application pins.
 *
 * Credential-gated and NOT part of `pnpm run test` or `pnpm run verify`, the
 * same rule this repository applies to every live-service check.
 *
 * Usage (build first, so `dist/` exists):
 *
 *   pnpm run build
 *   node --env-file=.env.local packages/ai/scripts/bake-off-llm.mjs
 *
 * Environment:
 *   LLM_API_KEY          required — never printed.
 *   LLM_BASE_URL         optional — defaults to the opencode-go base.
 *   LLM_BAKE_OFF_MODELS  optional — comma-separated ids. The live list is
 *                        authoritative: curl <base>/models
 *   LLM_TIMEOUT_MS       optional — per-request bound, defaults to 15000.
 */

import { createOpenCodeGoProvider, runAssessment } from "../dist/index.js";

const DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";
/**
 * The candidates worth comparing for THIS task. The 2026-09-22 run measured
 * seven models; every one returned schema-valid JSON with no invented
 * references, so admissibility did not discriminate and the choice came down to
 * latency. These are the three fastest, with the winner first.
 */
const DEFAULT_MODELS = ["glm-5.3-flash", "mimo-v2.6-flash", "deepseek-v4-flash"];
const DEFAULT_TIMEOUT_MS = 30_000;

/** The synthetic series from the demo; the same evidence the app would send. */
const PERIODS = [
  { period: "2026-01", amountArs: 1_200_000, status: "reported", evidenceRef: "sales:2026-01", simuladoLabel: "SIMULADO" },
  { period: "2026-02", amountArs: 1_150_000, status: "reported", evidenceRef: "sales:2026-02", simuladoLabel: "SIMULADO" },
  { period: "2026-03", amountArs: 1_240_000, status: "reported", evidenceRef: "sales:2026-03", simuladoLabel: "SIMULADO" },
  { period: "2026-04", amountArs: null, status: "missing", evidenceRef: "missing:2026-04", simuladoLabel: "SIMULADO" },
  { period: "2026-05", amountArs: 1_180_000, status: "reported", evidenceRef: "sales:2026-05", simuladoLabel: "SIMULADO" },
  { period: "2026-06", amountArs: 3_400_000, status: "anomalous", evidenceRef: "sales:2026-06", simuladoLabel: "SIMULADO" },
  { period: "2026-07", amountArs: 1_210_000, status: "reported", evidenceRef: "sales:2026-07", simuladoLabel: "SIMULADO" },
  { period: "2026-08", amountArs: 1_190_000, status: "reported", evidenceRef: "sales:2026-08", simuladoLabel: "SIMULADO" }
];

const FINDINGS = [
  { kind: "missing", period: "2026-04", evidenceRef: "missing:2026-04", messageKey: "sales.period.missing" },
  { kind: "anomalous", period: "2026-06", evidenceRef: "sales:2026-06", messageKey: "sales.period.outlier" }
];

const EVIDENCE = { periods: PERIODS, findings: FINDINGS };

async function measure({ baseUrl, apiKey, model, timeoutMs }) {
  const provider = createOpenCodeGoProvider({
    baseUrl,
    model,
    apiKey,
    timeoutMs,
    sessionId: `bake-off-${model}-${Date.now().toString(36)}`
  });

  const startedAt = Date.now();
  const result = await runAssessment(provider, { evidence: EVIDENCE, timeoutMs });
  const latencyMs = Date.now() - startedAt;

  if (!result.ok) {
    // The error vocabulary IS the report: the production path already
    // distinguishes a timeout from an outage from an inadmissible answer.
    return { model, latencyMs, outcome: result.error.code, invented: result.error.code === "unknown_evidence_reference" };
  }

  return {
    model,
    latencyMs,
    outcome: "valid",
    invented: false,
    riskBand: result.value.assessment.riskBand,
    confidence: result.value.assessment.confidence,
    promptVersion: result.value.metadata.promptVersion
  };
}

function pad(value, width) {
  return String(value ?? "-").padEnd(width);
}

async function main() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    console.error(
      "LLM_API_KEY is not set. Run with: node --env-file=.env.local packages/ai/scripts/bake-off-llm.mjs"
    );
    process.exitCode = 1;
    return;
  }

  const baseUrl = (process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const models = (process.env.LLM_BAKE_OFF_MODELS ?? DEFAULT_MODELS.join(","))
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  console.log(`provider base: ${baseUrl}`);
  console.log(`path under test: createOpenCodeGoProvider -> runAssessment (production)`);
  console.log(`models: ${models.join(", ")}   (live list: curl ${baseUrl}/models)\n`);

  const results = [];
  for (const model of models) {
    process.stdout.write(`… ${model}\n`);
    results.push(await measure({ baseUrl, apiKey, model, timeoutMs }));
  }

  console.log(
    `\n${pad("model", 22)}${pad("outcome", 28)}${pad("invented", 10)}${pad("ms", 8)}band / confidence`
  );
  for (const result of results) {
    console.log(
      pad(result.model, 22) +
        pad(result.outcome, 28) +
        pad(result.invented === undefined ? "-" : String(result.invented), 10) +
        pad(result.latencyMs, 8) +
        (result.outcome === "valid" ? `${result.riskBand} / ${result.confidence}` : "")
    );
  }

  const viable = results.filter((result) => result.outcome === "valid");
  console.log(
    viable.length > 0
      ? `\nadmissible: ${viable.map((result) => `${result.model} (${result.latencyMs} ms)`).join(", ")}`
      : "\nno candidate returned an admissible assessment — do not pick a model yet"
  );

  const unusable = results.filter((result) => result.outcome !== "valid");
  if (unusable.length > 0) {
    console.log(`not admissible: ${unusable.map((result) => `${result.model} (${result.outcome})`).join(", ")}`);
  }
}

await main();

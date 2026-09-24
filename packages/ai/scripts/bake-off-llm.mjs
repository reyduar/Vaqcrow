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
 *   node --env-file=.env.cloud packages/ai/scripts/bake-off-llm.mjs
 *
 * Environment:
 *   LLM_API_KEY          required — never printed.
 *   LLM_BASE_URL         optional — defaults to the opencode-go base.
 *   LLM_BAKE_OFF_MODELS  optional — comma-separated ids. The live list is
 *                        authoritative: curl <base>/models
 *   LLM_BAKE_OFF_SAMPLES optional — repeats per model, defaults to 3. One
 *                        sample is not a measurement.
 *   LLM_REASONING_EFFORT optional — the thinking budget. Defaults to
 *                        "default", which omits the switch entirely. The
 *                        2026-09-22 A/B showed the switch's effect is
 *                        model-dependent: it cut deepseek-v4-flash's median
 *                        from 19.9 s to 5.1 s while making glm-5.3-flash's
 *                        worst case worse, so it is not a global default.
 *   LLM_TIMEOUT_MS       optional — per-request bound, defaults to 30000.
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
const DEFAULT_SAMPLES = 3;
const DEFAULT_REASONING_EFFORT = "default";

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

async function measure({ baseUrl, apiKey, model, timeoutMs, reasoningEffort }) {
  const provider = createOpenCodeGoProvider({
    baseUrl,
    model,
    apiKey,
    timeoutMs,
    ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    sessionId: `bake-off-${model}-${Date.now().toString(36)}`
  });

  const startedAt = Date.now();
  const result = await runAssessment(provider, { evidence: EVIDENCE, timeoutMs });
  const latencyMs = Date.now() - startedAt;

  if (!result.ok) {
    // The error vocabulary IS the report: the production path already
    // distinguishes a timeout from an outage from an inadmissible answer.
    return { latencyMs, outcome: result.error.code };
  }

  return {
    latencyMs,
    outcome: "valid",
    riskBand: result.value.assessment.riskBand,
    confidence: result.value.assessment.confidence
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

function pad(value, width) {
  return String(value ?? "-").padEnd(width);
}

async function main() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    console.error(
      "LLM_API_KEY is not set. Run with: node --env-file=.env.cloud packages/ai/scripts/bake-off-llm.mjs"
    );
    process.exitCode = 1;
    return;
  }

  const baseUrl = (process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const samples = Number(process.env.LLM_BAKE_OFF_SAMPLES ?? DEFAULT_SAMPLES);
  const effortSetting = process.env.LLM_REASONING_EFFORT ?? DEFAULT_REASONING_EFFORT;
  // "default" omits the switch, so a run can measure what the provider does on
  // its own — which is the comparison that proves the switch is worth sending.
  const reasoningEffort = effortSetting === "default" ? undefined : effortSetting;
  const models = (process.env.LLM_BAKE_OFF_MODELS ?? DEFAULT_MODELS.join(","))
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  console.log(`provider base: ${baseUrl}`);
  console.log(`path under test: createOpenCodeGoProvider -> runAssessment (production)`);
  console.log(`thinking budget: ${reasoningEffort ?? "<provider default>"}   samples/model: ${samples}`);
  console.log(`models: ${models.join(", ")}   (live list: curl ${baseUrl}/models)\n`);

  const summaries = [];
  for (const model of models) {
    const runs = [];
    for (let index = 0; index < samples; index += 1) {
      process.stdout.write(`… ${model} (${index + 1}/${samples})\n`);
      runs.push(await measure({ baseUrl, apiKey, model, timeoutMs, reasoningEffort }));
    }

    const valid = runs.filter((run) => run.outcome === "valid");
    const latencies = valid.map((run) => run.latencyMs);
    summaries.push({
      model,
      valid: valid.length,
      outcomes: [...new Set(runs.map((run) => run.outcome))].join("/"),
      min: latencies.length > 0 ? Math.min(...latencies) : undefined,
      median: latencies.length > 0 ? median(latencies) : undefined,
      max: latencies.length > 0 ? Math.max(...latencies) : undefined
    });
  }

  console.log(
    `\n${pad("model", 22)}${pad("valid", 8)}${pad("outcomes", 24)}${pad("min", 8)}${pad("median", 9)}max`
  );
  for (const summary of summaries) {
    console.log(
      pad(summary.model, 22) +
        pad(`${summary.valid}/${samples}`, 8) +
        pad(summary.outcomes, 24) +
        pad(summary.min, 8) +
        pad(summary.median, 9) +
        pad(summary.max, 8)
    );
  }

  const admissible = summaries.filter((summary) => summary.valid === samples);
  console.log(
    admissible.length > 0
      ? `\nadmissible on every sample: ${admissible.map((s) => `${s.model} (median ${s.median} ms, max ${s.max} ms)`).join(", ")}`
      : "\nno model was admissible on every sample — do not pick one yet"
  );

  const unstable = summaries.filter((summary) => summary.valid !== samples);
  if (unstable.length > 0) {
    console.log(
      `not admissible on every sample: ${unstable.map((s) => `${s.model} (${s.outcomes})`).join(", ")}`
    );
  }
}

await main();

import { createSimulatedAssessmentProvider } from "@vaqcrow/ai";
import { describe, expect, it } from "vitest";
import { buildApp } from "../build-app.js";

/**
 * The HTTP surface of a real assessment (Task #228).
 *
 * The provider is the package's own simulated implementation, which is a real
 * implementation of the port and deterministic — so every case here runs with
 * no network and no credential, and the status mapping is tested against the
 * same codes the production path produces.
 */

const PERIOD = {
  period: "2026-01",
  amountArs: 1_200_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
} as const;

const EVIDENCE = { periods: [PERIOD], findings: [] };

const VALID_OUTPUT = {
  assessmentId: "asm_demo_001",
  riskBand: "medium",
  confidence: 0.72,
  reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
  anomalies: [],
  missingData: [],
  recommendedAction: "human_review",
  questions: []
};

const FIXED_NOW = "2026-09-22T12:00:00.000Z";

function appWith(output: unknown, failWith?: "timeout" | "provider_unavailable") {
  return buildApp({
    assessment: {
      provider: createSimulatedAssessmentProvider({
        output,
        ...(failWith === undefined ? {} : { failWith }),
        now: () => FIXED_NOW
      }),
      timeoutMs: 5_000
    }
  });
}

describe("POST /assessments", () => {
  it("returns the validated assessment with its model and prompt metadata", async () => {
    const app = appWith(VALID_OUTPUT);

    const response = await app.inject({
      method: "POST",
      url: "/assessments",
      payload: { evidence: EVIDENCE }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assessment.riskBand).toBe("medium");
    expect(body.metadata).toEqual({
      model: "simulated-underwriter",
      promptVersion: "prompt-v1",
      generatedAt: FIXED_NOW,
      source: "simulated"
    });
  });

  it("refuses a body whose key set drifted, before the provider is called", async () => {
    let called = false;
    const app = buildApp({
      assessment: {
        provider: {
          assess: async () => {
            called = true;
            return { ok: false, error: { code: "provider_unavailable" } };
          }
        },
        timeoutMs: 5_000
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/assessments",
      payload: { evidence: EVIDENCE, extra: true }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(called).toBe(false);
  });

  it("refuses an evidence bundle that does not satisfy the shared contract", async () => {
    const app = appWith(VALID_OUTPUT);

    const response = await app.inject({
      method: "POST",
      url: "/assessments",
      payload: { evidence: { periods: [], findings: [] } }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("refuses an evidence period carrying an undeclared field", async () => {
    const app = appWith(VALID_OUTPUT);

    const response = await app.inject({
      method: "POST",
      url: "/assessments",
      payload: { evidence: { periods: [{ ...PERIOD, internalNote: "nope" }], findings: [] } }
    });

    expect(response.statusCode).toBe(400);
  });

  it("answers 504 for a provider that times out, and never an assessment", async () => {
    const app = appWith(VALID_OUTPUT, "timeout");

    const response = await app.inject({
      method: "POST",
      url: "/assessments",
      payload: { evidence: EVIDENCE }
    });

    expect(response.statusCode).toBe(504);
    expect(response.json()).toEqual({ code: "timeout" });
  });

  it("answers 503 for an unavailable provider", async () => {
    const app = appWith(VALID_OUTPUT, "provider_unavailable");

    const response = await app.inject({
      method: "POST",
      url: "/assessments",
      payload: { evidence: EVIDENCE }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "provider_unavailable" });
  });

  it("answers 502 when the provider's answer is not admissible", async () => {
    const app = appWith({ ...VALID_OUTPUT, confidence: 72 });

    const response = await app.inject({
      method: "POST",
      url: "/assessments",
      payload: { evidence: EVIDENCE }
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ code: "invalid_output" });
  });

  it("answers 502 with the offending references when the model cited unseen evidence", async () => {
    const app = appWith({
      ...VALID_OUTPUT,
      reasons: [{ claim: "Inventada", evidenceRefs: ["sales:2025-12"] }]
    });

    const response = await app.inject({
      method: "POST",
      url: "/assessments",
      payload: { evidence: EVIDENCE }
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      code: "unknown_evidence_reference",
      violations: [
        { code: "unknown_evidence_reference", reference: "sales:2025-12", path: "reasons.0" }
      ]
    });
  });

  it("is not registered when no provider is supplied", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/assessments",
      payload: { evidence: EVIDENCE }
    });

    expect(response.statusCode).toBe(404);
  });

  it("carries the correlation id on the response", async () => {
    const app = appWith(VALID_OUTPUT);

    const response = await app.inject({
      method: "POST",
      url: "/assessments",
      payload: { evidence: EVIDENCE }
    });

    expect(response.headers["x-correlation-id"]).toBeTruthy();
  });
});

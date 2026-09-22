import { describe, expect, it } from "vitest";
import { HttpAssessmentGateway } from "./http-assessment-gateway.js";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HttpClientPort, HttpRequest, HttpResponse } from "@/application/ports/http-client-port";
import type { AssessmentEvidence } from "@/application/ports/assessment-gateway";

/**
 * The web's side of `POST /assessments`.
 *
 * The transport is a double, so every case is offline. What matters here is the
 * body the gateway sends — the API refuses any key set but `evidence` — and the
 * fact that a drifted response is refused rather than half-rendered.
 */

const PERIOD = {
  period: "2026-01",
  amountArs: 1_200_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
} as const;

const EVIDENCE: AssessmentEvidence = { periods: [PERIOD], findings: [] };

const RESPONSE = {
  assessment: {
    assessmentId: "asm_demo_001",
    riskBand: "medium",
    confidence: 0.72,
    reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
    anomalies: [{ type: "outlier", evidenceRef: "sales:2026-06", severity: "review" }],
    missingData: ["Declaración del período 2026-04"],
    recommendedAction: "human_review",
    questions: ["¿Qué explica el incremento de junio?"]
  },
  metadata: {
    model: "glm-5.3-flash",
    promptVersion: "assessment-v1",
    generatedAt: "2026-09-22T12:00:00.000Z",
    source: "provider"
  }
};

function gatewayReturning(body: unknown): {
  gateway: HttpAssessmentGateway;
  sent: HttpRequest[];
} {
  const sent: HttpRequest[] = [];
  const http: HttpClientPort = {
    send: async <T>(request: HttpRequest): Promise<HttpResponse<T>> => {
      sent.push(request);
      return { status: 200, body: body as T };
    }
  };
  return { gateway: new HttpAssessmentGateway(http), sent };
}

describe("HttpAssessmentGateway", () => {
  it("posts the evidence bundle to /assessments and returns the parsed view", async () => {
    const { gateway, sent } = gatewayReturning(RESPONSE);

    const view = await gateway.assess(EVIDENCE);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe("POST");
    expect(sent[0]?.path).toBe("/assessments");
    // Exactly `evidence`: the API refuses any other key set.
    expect(Object.keys(sent[0]?.body as Record<string, unknown>)).toEqual(["evidence"]);
    expect((sent[0]?.body as { evidence: unknown }).evidence).toEqual(EVIDENCE);

    expect(view.riskBand).toBe("medium");
    expect(view.confidence).toBe(0.72);
    expect(view.reasons[0]?.evidenceRefs).toEqual(["sales:2026-01"]);
    expect(view.recommendedAction).toBe("human_review");
  });

  it("carries the provenance through, so a simulated evaluation stays labelable", async () => {
    const { gateway } = gatewayReturning(RESPONSE);

    const view = await gateway.assess(EVIDENCE);

    expect(view.provenance).toEqual({
      model: "glm-5.3-flash",
      promptVersion: "assessment-v1",
      generatedAt: "2026-09-22T12:00:00.000Z",
      source: "provider"
    });
  });

  it("refuses an envelope carrying a key the screen does not expect", async () => {
    const { gateway } = gatewayReturning({ ...RESPONSE, extra: true });

    await expect(gateway.assess(EVIDENCE)).rejects.toThrow(TypeError);
  });

  it("refuses a risk band outside the closed set", async () => {
    const { gateway } = gatewayReturning({
      ...RESPONSE,
      assessment: { ...RESPONSE.assessment, riskBand: "critical" }
    });

    await expect(gateway.assess(EVIDENCE)).rejects.toThrow(/riskBand/);
  });

  it("refuses a confidence outside 0..1", async () => {
    const { gateway } = gatewayReturning({
      ...RESPONSE,
      assessment: { ...RESPONSE.assessment, confidence: 72 }
    });

    await expect(gateway.assess(EVIDENCE)).rejects.toThrow(/confidence/);
  });

  it("refuses a recommendation outside the closed action set", async () => {
    const { gateway } = gatewayReturning({
      ...RESPONSE,
      assessment: { ...RESPONSE.assessment, recommendedAction: "approved" }
    });

    await expect(gateway.assess(EVIDENCE)).rejects.toThrow(/recommendedAction/);
  });

  it("refuses a claim that cites no evidence", async () => {
    const { gateway } = gatewayReturning({
      ...RESPONSE,
      assessment: {
        ...RESPONSE.assessment,
        reasons: [{ claim: "Sin respaldo", evidenceRefs: [] }]
      }
    });

    // The model contract requires at least one citation, so an uncited claim
    // means the response drifted and must not reach the screen.
    await expect(gateway.assess(EVIDENCE)).rejects.toThrow(/evidenceRefs/);
  });

  it("lets the backend's own failure code surface as an HttpClientError", async () => {
    const http: HttpClientPort = {
      send: async () => {
        throw new HttpClientError("http", 502, undefined, "invalid_output");
      }
    };

    await expect(new HttpAssessmentGateway(http).assess(EVIDENCE)).rejects.toMatchObject({
      errorCode: "invalid_output",
      status: 502
    });
  });
});

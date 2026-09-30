import { describe, expect, it } from "vitest";
import { HttpAssessmentGateway } from "./http-assessment-gateway.js";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HttpClientPort, HttpRequest, HttpResponse } from "@/application/ports/http-client-port";

/**
 * The web's side of the application-scoped assessment routes:
 * `POST /application-reviews/:id/assessments` and `GET .../assessment`.
 *
 * The transport is a double, so every case is offline. What matters here is the
 * body the gateway sends — only the per-attempt `handoffId`, never evidence —
 * how each backend outcome is told apart, and that a drifted response is
 * refused rather than half-rendered.
 */

const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const HANDOFF_ID = "44444444-4444-4444-8444-444444444444";
const ASSESSMENT_PATH = `/application-reviews/${APPLICATION_ID}/assessments`;

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

const RECORDED = {
  outcome: "assessment_recorded",
  applicationState: "human_review",
  applied: true,
  correlationId: "11111111-2222-4333-8444-555555555555",
  ...RESPONSE,
  recordedAt: "2026-09-30T12:00:01.000Z"
};

const MANUAL_REVIEW = {
  outcome: "manual_review",
  manualReviewRequired: true,
  inputsPreserved: true,
  applicationState: "human_review",
  failureCode: "timeout",
  handoff: "persisted",
  correlationId: "11111111-2222-4333-8444-555555555555",
  applied: true
};

function gatewayWith(step: (request: HttpRequest) => unknown): {
  gateway: HttpAssessmentGateway;
  sent: HttpRequest[];
} {
  const sent: HttpRequest[] = [];
  const http: HttpClientPort = {
    send: async <T>(request: HttpRequest): Promise<HttpResponse<T>> => {
      sent.push(request);
      const result = step(request);
      if (result instanceof Error) throw result;
      return { status: 200, body: result as T };
    }
  };
  return { gateway: new HttpAssessmentGateway(http), sent };
}

const gatewayReturning = (body: unknown) => gatewayWith(() => body);
const assess = (gateway: HttpAssessmentGateway) => gateway.assess(APPLICATION_ID, HANDOFF_ID);

describe("HttpAssessmentGateway.assess", () => {
  it("posts only the handoff id to the application-scoped route and returns the parsed view", async () => {
    const { gateway, sent } = gatewayReturning(RECORDED);

    const outcome = await assess(gateway);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe("POST");
    expect(sent[0]?.path).toBe(ASSESSMENT_PATH);
    // The evidence is derived server-side: the body is exactly the attempt key.
    expect(sent[0]?.body).toEqual({ handoffId: HANDOFF_ID });
    expect(outcome.kind).toBe("recorded");
    if (outcome.kind !== "recorded") throw new Error("unreachable");
    expect(outcome.view.riskBand).toBe("medium");
    expect(outcome.view.confidence).toBe(0.72);
    expect(outcome.view.reasons[0]?.evidenceRefs).toEqual(["sales:2026-01"]);
    expect(outcome.view.recommendedAction).toBe("human_review");
  });

  it("carries the provenance through, so a simulated evaluation stays labelable", async () => {
    const outcome = await assess(gatewayReturning(RECORDED).gateway);

    expect(outcome).toMatchObject({
      kind: "recorded",
      view: {
        provenance: {
          model: "glm-5.3-flash",
          promptVersion: "assessment-v1",
          generatedAt: "2026-09-22T12:00:00.000Z",
          source: "provider"
        }
      }
    });
  });

  it("reports the manual-review routing with its failure code and no assessment", async () => {
    const outcome = await assess(gatewayReturning(MANUAL_REVIEW).gateway);

    expect(outcome).toEqual({ kind: "manual_review", failureCode: "timeout" });
  });

  it("reports a missing sales series (409 sales_evidence_missing) as its own outcome, not an error", async () => {
    const { gateway } = gatewayWith(() => new HttpClientError("http", 409, undefined, "sales_evidence_missing"));

    expect(await assess(gateway)).toEqual({ kind: "sales_evidence_missing" });
  });

  it("lets any other backend failure surface as an HttpClientError", async () => {
    for (const [status, code] of [
      [404, "not_found"],
      [409, "state_conflict"],
      [409, "correlation_conflict"],
      [503, "unavailable"]
    ] as const) {
      const { gateway } = gatewayWith(() => new HttpClientError("http", status, undefined, code));

      await expect(assess(gateway)).rejects.toMatchObject({ errorCode: code, status });
    }
  });

  it.each([
    ["an unknown outcome", { ...RECORDED, outcome: "approved" }],
    ["a manual review with an unknown failure code", { ...MANUAL_REVIEW, failureCode: "boom" }],
    ["a manual review that claims it is not in human review", { ...MANUAL_REVIEW, applicationState: "approved" }],
    ["a non-object body", "ok"]
  ])("refuses %s", async (_label, body) => {
    await expect(assess(gatewayReturning(body).gateway)).rejects.toThrow(TypeError);
  });

  it("refuses a recorded assessment whose application state is not human_review", async () => {
    await expect(
      assess(gatewayReturning({ ...RECORDED, applicationState: "approved" }).gateway)
    ).rejects.toThrow(TypeError);
  });

  it("refuses a risk band outside the closed set", async () => {
    const { gateway } = gatewayReturning({
      ...RECORDED,
      assessment: { ...RECORDED.assessment, riskBand: "critical" }
    });

    await expect(assess(gateway)).rejects.toThrow(/riskBand/);
  });

  it("refuses a confidence outside 0..1", async () => {
    const { gateway } = gatewayReturning({
      ...RECORDED,
      assessment: { ...RECORDED.assessment, confidence: 72 }
    });

    await expect(assess(gateway)).rejects.toThrow(/confidence/);
  });

  it("refuses a recommendation outside the closed action set", async () => {
    const { gateway } = gatewayReturning({
      ...RECORDED,
      assessment: { ...RECORDED.assessment, recommendedAction: "approved" }
    });

    await expect(assess(gateway)).rejects.toThrow(/recommendedAction/);
  });

  it("refuses a claim that cites no evidence", async () => {
    const { gateway } = gatewayReturning({
      ...RECORDED,
      assessment: { ...RECORDED.assessment, reasons: [{ claim: "Sin respaldo", evidenceRefs: [] }] }
    });

    // The model contract requires at least one citation, so an uncited claim
    // means the response drifted and must not reach the screen.
    await expect(assess(gateway)).rejects.toThrow(/evidenceRefs/);
  });
});

describe("HttpAssessmentGateway.load", () => {
  const READ = { ...RESPONSE, recordedAt: "2026-09-30T12:00:01.000Z" };

  it("reads the persisted assessment of the application and returns the parsed view", async () => {
    const { gateway, sent } = gatewayReturning(READ);

    const view = await gateway.load(APPLICATION_ID);

    expect(sent).toEqual([{ method: "GET", path: `/application-reviews/${APPLICATION_ID}/assessment` }]);
    expect(view).toMatchObject({ assessmentId: "asm_demo_001", riskBand: "medium" });
  });

  it("resolves null on 404: the backend's truthful 'no assessment recorded'", async () => {
    const { gateway } = gatewayWith(() => new HttpClientError("http", 404, undefined, "not_found"));

    expect(await gateway.load(APPLICATION_ID)).toBeNull();
  });

  it("rethrows every other failure, so an outage is never read as 'no assessment'", async () => {
    const { gateway } = gatewayWith(() => new HttpClientError("http", 503, undefined, "unavailable"));

    await expect(gateway.load(APPLICATION_ID)).rejects.toMatchObject({ status: 503 });
  });

  it("refuses a drifted body", async () => {
    const { gateway } = gatewayReturning({ ...READ, extra: 1 });

    await expect(gateway.load(APPLICATION_ID)).rejects.toThrow(TypeError);
  });
});

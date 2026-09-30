import { describe, expect, it } from "vitest";
import {
  applicationAssessmentOutcomeSchema,
  applicationAssessmentReadSchema,
  applicationAssessmentSchema,
  parseApplicationAssessmentRead
} from "./index.js";

const ASSESSMENT = {
  assessmentId: "asm_demo_001",
  riskBand: "medium",
  confidence: 0.72,
  reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
  anomalies: [{ type: "outlier", evidenceRef: "sales:2026-06", severity: "review" }],
  missingData: [],
  recommendedAction: "human_review",
  questions: []
};

const METADATA = {
  model: "demo-model",
  promptVersion: "v1",
  generatedAt: "2026-09-30T12:00:00.000Z",
  source: "simulated"
};

const READ = { assessment: ASSESSMENT, metadata: METADATA, recordedAt: "2026-09-30T12:00:01.000Z" };

describe("application assessment contracts", () => {
  it("accepts the persisted assessment read shape", () => {
    expect(parseApplicationAssessmentRead(READ)).toEqual(READ);
  });

  it("is strict: an unknown key on the read, the assessment or the metadata is rejected", () => {
    expect(applicationAssessmentReadSchema.safeParse({ ...READ, prompt: "raw" }).success).toBe(false);
    expect(
      applicationAssessmentSchema.safeParse({ ...ASSESSMENT, toolCall: "transfer" }).success
    ).toBe(false);
    expect(
      applicationAssessmentReadSchema.safeParse({
        ...READ,
        metadata: { ...METADATA, providerPayload: {} }
      }).success
    ).toBe(false);
  });

  it("keeps the recommendation closed to human review", () => {
    expect(
      applicationAssessmentSchema.safeParse({ ...ASSESSMENT, recommendedAction: "approve" }).success
    ).toBe(false);
  });

  it("requires a valid recordedAt timestamp and a non-empty reason list", () => {
    expect(applicationAssessmentReadSchema.safeParse({ ...READ, recordedAt: "yesterday" }).success).toBe(false);
    expect(applicationAssessmentSchema.safeParse({ ...ASSESSMENT, reasons: [] }).success).toBe(false);
  });

  it("describes the recorded outcome of the POST as human_review with the stored assessment", () => {
    const outcome = {
      outcome: "assessment_recorded",
      applicationState: "human_review",
      applied: true,
      correlationId: "123e4567-e89b-42d3-a456-426614174000",
      ...READ
    };
    expect(applicationAssessmentOutcomeSchema.parse(outcome)).toEqual(outcome);
    expect(
      applicationAssessmentOutcomeSchema.safeParse({ ...outcome, applicationState: "approved" }).success
    ).toBe(false);
  });
});

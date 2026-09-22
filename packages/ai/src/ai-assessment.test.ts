import { describe, expect, it } from "vitest";
import {
  aiAssessmentSchema,
  parseAiAssessment,
  validateAssessmentEvidence
} from "./index.js";

const VALID_ASSESSMENT = {
  assessmentId: "asm_demo_001",
  riskBand: "medium",
  confidence: 0.72,
  reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
  anomalies: [{ type: "outlier", evidenceRef: "sales:2026-06", severity: "review" }],
  missingData: ["Declaración del período 2026-04"],
  recommendedAction: "human_review",
  questions: ["¿Qué explica el incremento de junio?"]
} as const;

const SUPPLIED_REFERENCES = ["sales:2026-01", "sales:2026-06", "missing:2026-04"];

describe("aiAssessmentSchema", () => {
  it("accepts the documented structured assessment shape", () => {
    const assessment = parseAiAssessment(VALID_ASSESSMENT);

    expect(assessment.riskBand).toBe("medium");
    expect(assessment.confidence).toBe(0.72);
    expect(assessment.reasons[0]?.evidenceRefs).toEqual(["sales:2026-01"]);
  });

  it("rejects an assessment carrying a field the contract does not declare", () => {
    const result = aiAssessmentSchema.safeParse({
      ...VALID_ASSESSMENT,
      toolCalls: [{ name: "transfer_funds" }]
    });

    expect(result.success).toBe(false);
  });

  it("rejects a reason that does not cite any evidence", () => {
    const result = aiAssessmentSchema.safeParse({
      ...VALID_ASSESSMENT,
      reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: [] }]
    });

    expect(result.success).toBe(false);
  });

  it("rejects a recommendation outside the closed action set", () => {
    const result = aiAssessmentSchema.safeParse({
      ...VALID_ASSESSMENT,
      recommendedAction: "approved"
    });

    expect(result.success).toBe(false);
  });
});

describe("validateAssessmentEvidence", () => {
  it("accepts an assessment whose references all exist in the supplied evidence", () => {
    const assessment = parseAiAssessment(VALID_ASSESSMENT);

    expect(validateAssessmentEvidence(assessment, SUPPLIED_REFERENCES)).toEqual({ ok: true });
  });

  it("reports every reference that the supplied evidence does not contain", () => {
    const assessment = parseAiAssessment({
      ...VALID_ASSESSMENT,
      reasons: [
        { claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01", "sales:2026-12"] }
      ],
      anomalies: [{ type: "outlier", evidenceRef: "sales:2099-01", severity: "review" }]
    });

    const result = validateAssessmentEvidence(assessment, SUPPLIED_REFERENCES);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.violations).toEqual([
      { code: "unknown_evidence_reference", reference: "sales:2026-12", path: "reasons.0" },
      { code: "unknown_evidence_reference", reference: "sales:2099-01", path: "anomalies.0" }
    ]);
  });
});

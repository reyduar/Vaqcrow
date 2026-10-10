import { describe, expect, it } from "vitest";
import type { ApplicationAssessmentRead } from "@vaqcrow/contracts";
import {
  ASSESSMENT_COPY,
  assessmentSectionFor,
  formatAssessmentConfidence,
  formatAssessmentTimestamp
} from "./assessment";

const READ: ApplicationAssessmentRead = {
  assessment: {
    assessmentId: "asm_demo-001",
    riskBand: "medium",
    confidence: 0.72,
    reasons: [
      { claim: "Ventas estables, 7 de 8 períodos declarados.", evidenceRefs: ["sales:2026-01", "sales:2026-02"] }
    ],
    anomalies: [
      { type: "outlier", evidenceRef: "sales:2026-06", severity: "review" },
      { type: "contradiction", evidenceRef: "doc:cuit", severity: "info" }
    ],
    missingData: ["Declaración de abril 2026."],
    recommendedAction: "human_review",
    questions: ["¿Qué explica el pico de junio?"]
  },
  metadata: {
    model: "evaluador-v1",
    promptVersion: "prompt-v3",
    generatedAt: "2026-09-12T13:40:00.000Z",
    source: "provider"
  },
  recordedAt: "2026-09-12T13:42:00.000Z"
};

function withAssessment(patch: Partial<ApplicationAssessmentRead["assessment"]>): ApplicationAssessmentRead {
  return { ...READ, assessment: { ...READ.assessment, ...patch } };
}

describe("formatAssessmentConfidence", () => {
  it("uses a Spanish decimal comma with two decimals, as the template's «Confianza 0,72»", () => {
    expect(formatAssessmentConfidence(0.72)).toBe("0,72");
    expect(formatAssessmentConfidence(0.5)).toBe("0,50");
    expect(formatAssessmentConfidence(0.456)).toBe("0,46");
  });

  it("formats the edge values 0 and 1", () => {
    expect(formatAssessmentConfidence(0)).toBe("0,00");
    expect(formatAssessmentConfidence(1)).toBe("1,00");
  });
});

describe("formatAssessmentTimestamp", () => {
  it("renders dd/mm/aaaa hh:mm in Argentina's time zone, independent of the viewer's clock", () => {
    expect(formatAssessmentTimestamp("2026-09-12T13:42:00.000Z")).toBe("12/09/2026 10:42");
    expect(formatAssessmentTimestamp("2026-01-02T03:05:00.000Z")).toBe("02/01/2026 00:05");
  });

  it("is honest when the timestamp cannot be read", () => {
    expect(formatAssessmentTimestamp("not-a-date")).toBe("Sin dato");
  });
});

describe("assessmentSectionFor", () => {
  it("returns the empty state when there is no assessment, never a risk or a recommendation", () => {
    expect(assessmentSectionFor(null)).toEqual({ kind: "empty", message: ASSESSMENT_COPY.empty });
  });

  it("maps every risk band to its template label, an icon and a tone (never color alone)", () => {
    const chips = (["low", "medium", "high"] as const).map((riskBand) => {
      const view = assessmentSectionFor(withAssessment({ riskBand }));
      if (view.kind !== "assessment") throw new Error("expected an assessment");
      return view.risk;
    });

    expect(chips).toEqual([
      { label: "Riesgo bajo", icon: "low", tone: "neutral" },
      { label: "Riesgo medio", icon: "medium", tone: "caution" },
      { label: "Riesgo alto", icon: "high", tone: "critical" }
    ]);
  });

  it("builds the chips, the list items in the template's order and the footer", () => {
    const view = assessmentSectionFor(READ);
    if (view.kind !== "assessment") throw new Error("expected an assessment");

    expect(view.confidenceLabel).toBe("Confianza 0,72");
    expect(view.items).toEqual([
      {
        kind: "reason",
        text: "Ventas estables, 7 de 8 períodos declarados.",
        evidence: "Evidencia: sales:2026-01, sales:2026-02"
      },
      { kind: "anomaly", text: "Anomalía: valor atípico en sales:2026-06 · a revisar" },
      { kind: "anomaly", text: "Anomalía: contradicción en doc:cuit · informativa" },
      { kind: "missing", text: "Faltante: Declaración de abril 2026." },
      { kind: "question", text: "Pregunta sugerida: ¿Qué explica el pico de junio?" }
    ]);
    expect(view.footer).toBe("evaluador-v1 · 12/09/2026 10:42");
    expect(view.simulated).toBe(false);
  });

  it("keeps only the reasons when anomalies, missing data and questions are empty", () => {
    const view = assessmentSectionFor(withAssessment({ anomalies: [], missingData: [], questions: [] }));
    if (view.kind !== "assessment") throw new Error("expected an assessment");

    expect(view.items.map((item) => item.kind)).toEqual(["reason"]);
  });

  it("flags a simulated assessment so its origin is labelled", () => {
    const view = assessmentSectionFor({ ...READ, metadata: { ...READ.metadata, source: "simulated" } });
    if (view.kind !== "assessment") throw new Error("expected an assessment");

    expect(view.simulated).toBe(true);
  });

  it("states that the AI is advisory and never approves", () => {
    expect(ASSESSMENT_COPY.title).toBe("2 · Recomendación de IA");
    expect(ASSESSMENT_COPY.advisory).toBe("Consultiva · no aprueba");
  });
});

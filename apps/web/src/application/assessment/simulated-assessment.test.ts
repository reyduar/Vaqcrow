import { describe, expect, it } from "vitest";
import { panaderiaHorizonte } from "@/application/fixtures/panaderia-horizonte";
import { simulatedAssessment } from "./simulated-assessment";

describe("simulatedAssessment fixture", () => {
  it("is labelled as a simulated, non-live, advisory-only assessment", () => {
    expect(simulatedAssessment.simuladoLabel).toBe("SIMULADO");
    expect(simulatedAssessment.source).toBe("fixture");
    expect(simulatedAssessment.recommendation).toBe("human_review");
  });

  it("keeps risk band and confidence as separate concepts", () => {
    expect(simulatedAssessment.riskBand).toBe("medium");
    expect(simulatedAssessment.confidencePercent).toBe(72);
  });

  it("cites only evidence references that exist in the synthetic sales series", () => {
    const known = new Set(panaderiaHorizonte.sales.map((period) => period.evidenceRef));
    expect(simulatedAssessment.reasons.length).toBeGreaterThan(0);
    for (const reason of simulatedAssessment.reasons) {
      expect(reason.evidenceRefs.length).toBeGreaterThan(0);
      for (const ref of reason.evidenceRefs) expect(known.has(ref)).toBe(true);
    }
  });

  it("surfaces the missing period, the anomaly, uncertainty and a pending question", () => {
    const refs = simulatedAssessment.reasons.flatMap((reason) => reason.evidenceRefs);
    expect(refs).toContain("missing:2026-04");
    expect(refs).toContain("sales:2026-06");
    expect(simulatedAssessment.uncertainty.length).toBeGreaterThan(0);
    expect(simulatedAssessment.pendingQuestions.length).toBeGreaterThan(0);
  });

  it("never asserts a cause for the June anomaly nor a monetary amount", () => {
    const text = JSON.stringify(simulatedAssessment);
    expect(text).not.toMatch(/\$\s?\d|ARS\s?\d/);
    expect(text).not.toMatch(/fraude|estacional|promoci/i);
  });
});

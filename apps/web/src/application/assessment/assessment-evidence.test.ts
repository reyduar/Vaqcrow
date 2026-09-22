import { describe, expect, it } from "vitest";
import { toAssessmentEvidence } from "./assessment-evidence";
import { panaderiaHorizonte } from "@/application/fixtures/panaderia-horizonte";

/**
 * The projection into the evidence contract.
 *
 * The fixture carries presentation fields the contract does not declare, and
 * `salesPeriodSchema` is a strict object — so this test is the one that keeps a
 * `label` or a `provenance` from travelling to the model by accident.
 */

describe("toAssessmentEvidence", () => {
  it("carries exactly the five fields the evidence contract declares", () => {
    const evidence = toAssessmentEvidence(panaderiaHorizonte.sales);

    expect(evidence.periods).toHaveLength(panaderiaHorizonte.sales.length);

    for (const period of evidence.periods) {
      expect(Object.keys(period).sort()).toEqual([
        "amountArs",
        "evidenceRef",
        "period",
        "simuladoLabel",
        "status"
      ]);
    }
  });

  it("drops the presentation fields the fixture carries for the screen", () => {
    const evidence = toAssessmentEvidence(panaderiaHorizonte.sales);

    for (const period of evidence.periods) {
      expect(period).not.toHaveProperty("label");
      expect(period).not.toHaveProperty("provenance");
      expect(period).not.toHaveProperty("note");
    }
  });

  it("preserves the reference untouched, because it is the string the model may cite", () => {
    const evidence = toAssessmentEvidence(panaderiaHorizonte.sales);

    expect(evidence.periods.map((period) => period.evidenceRef)).toEqual(
      panaderiaHorizonte.sales.map((period) => period.evidenceRef)
    );
  });

  it("sends no findings when none are supplied, which the contract allows", () => {
    expect(toAssessmentEvidence(panaderiaHorizonte.sales).findings).toEqual([]);
  });
});

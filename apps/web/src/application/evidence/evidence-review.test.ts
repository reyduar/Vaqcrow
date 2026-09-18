import { describe, expect, it } from "vitest";
import { panaderiaHorizonte, SIMULADO_LABEL } from "../fixtures/panaderia-horizonte";
import {
  contradictoryRequest,
  contradictorySalesPeriods
} from "../fixtures/contradictory-request";
import { deriveReviewFindings, resolveEvidenceRef } from "./evidence-review";

const registry = {
  "sales:2026-01": { provenance: "Declaración mensual sintética" }
} as const;

describe("resolveEvidenceRef", () => {
  it("resolves a known reference to its registry entry", () => {
    expect(resolveEvidenceRef("sales:2026-01", registry)).toEqual({
      status: "resolved",
      ref: "sales:2026-01",
      entry: { provenance: "Declaración mensual sintética" }
    });
  });

  it("reports an unknown reference as unresolved without inventing data", () => {
    expect(resolveEvidenceRef("sales:1999-01", registry)).toEqual({
      status: "unresolved",
      ref: "sales:1999-01"
    });
  });

  it("does not resolve inherited object keys", () => {
    expect(resolveEvidenceRef("constructor", registry).status).toBe("unresolved");
    expect(resolveEvidenceRef("toString", registry).status).toBe("unresolved");
  });

  it("treats an empty reference as unresolved", () => {
    expect(resolveEvidenceRef("", registry).status).toBe("unresolved");
  });
});

const request = {
  smeReference: "sme:TEST",
  declaredTotalArs: 300,
  periodStart: "2026-01",
  periodEnd: "2026-03",
  simuladoLabel: SIMULADO_LABEL
} as const;

const period = (
  month: string,
  amountArs: number | null,
  status: "reported" | "missing" | "anomalous"
) => ({
  period: month,
  amountArs,
  status,
  evidenceRef: `sales:${month}`,
  simuladoLabel: SIMULADO_LABEL
});

describe("deriveReviewFindings", () => {
  it("returns no findings when everything is reported and totals match", () => {
    const periods = [period("2026-01", 100, "reported"), period("2026-02", 200, "reported")];
    expect(deriveReviewFindings(request, periods)).toEqual([]);
  });

  it("flags a missing period with its reference and never fills the amount", () => {
    const periods = [period("2026-01", 300, "reported"), period("2026-02", null, "missing")];
    const findings = deriveReviewFindings(request, periods);
    expect(findings).toEqual([
      {
        kind: "missing",
        period: "2026-02",
        evidenceRef: "sales:2026-02",
        messageKey: "review.finding.missing"
      }
    ]);
    expect(periods[1]?.amountArs).toBeNull();
  });

  it("flags an anomalous period", () => {
    const periods = [period("2026-01", 300, "reported"), period("2026-02", 999, "anomalous")];
    expect(deriveReviewFindings(request, periods)).toEqual([
      {
        kind: "anomalous",
        period: "2026-02",
        evidenceRef: "sales:2026-02",
        messageKey: "review.finding.anomalous"
      }
    ]);
  });

  it("flags a contradictory request when the declared total differs from the reported sum", () => {
    const periods = [period("2026-01", 100, "reported"), period("2026-02", 100, "reported")];
    expect(deriveReviewFindings(request, periods)).toEqual([
      { kind: "contradictory", messageKey: "review.finding.contradictory" }
    ]);
  });

  it("does not mutate its inputs", () => {
    const periods = Object.freeze([
      Object.freeze(period("2026-01", 100, "reported")),
      Object.freeze(period("2026-02", null, "missing"))
    ]);
    expect(() => deriveReviewFindings(Object.freeze({ ...request }), periods)).not.toThrow();
  });

  it("derives the contradictory case from the synthetic fixture", () => {
    const findings = deriveReviewFindings(contradictoryRequest, contradictorySalesPeriods);
    expect(findings.map((finding) => finding.kind)).toEqual(["contradictory"]);
  });

  it("derives missing and anomalous findings from the existing Panadería fixture", () => {
    const findings = deriveReviewFindings(
      { ...request, declaredTotalArs: 0 },
      panaderiaHorizonte.sales
    );
    const byKind = (kind: string) => findings.filter((finding) => finding.kind === kind);
    expect(byKind("missing").map((finding) => finding.period)).toEqual(["2026-04"]);
    expect(byKind("anomalous").map((finding) => finding.period)).toEqual(["2026-06"]);
  });
});

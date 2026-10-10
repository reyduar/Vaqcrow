import { describe, expect, it } from "vitest";
import {
  checkCompleteness,
  COMPLETENESS_DOCUMENT_LABELS,
  type CompletenessCheckInput,
  type CompletenessDocument,
  type CompletenessFinding,
  type CompletenessSalesMonth
} from "./completeness-check.js";

function document(
  kind: CompletenessDocument["kind"],
  present: boolean
): CompletenessDocument {
  return { kind, present };
}

const ALL_PRESENT: readonly CompletenessDocument[] = [
  document("sales-declarations", true),
  document("cuit", true),
  document("articles-of-incorporation", true)
];

function months(values: ReadonlyArray<number | null>): readonly CompletenessSalesMonth[] {
  const labels = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto"];
  return labels.map((month, index) => ({ month, valueArs: values[index] ?? null }));
}

const SIX_VALUED = months([3_100_000, 3_200_000, 3_300_000, null, 3_400_000, 3_500_000, 3_600_000, null]);

function input(overrides: Partial<CompletenessCheckInput> = {}): CompletenessCheckInput {
  return {
    documents: ALL_PRESENT,
    photoCount: 2,
    salesMonths: SIX_VALUED,
    ...overrides
  };
}

function codes(findings: readonly CompletenessFinding[]): readonly string[] {
  return findings.map((finding) => finding.code);
}

describe("checkCompleteness", () => {
  it("marks a complete application complete with no findings", () => {
    const result = checkCompleteness(input());

    expect(result).toEqual({ complete: true, findings: [] });
  });

  it("reports a missing mandatory document as a gap naming it in Spanish", () => {
    const result = checkCompleteness(
      input({
        documents: [document("sales-declarations", true), document("articles-of-incorporation", true)]
      })
    );

    expect(result.complete).toBe(false);
    expect(result.findings).toEqual([
      { code: "missing_document", severity: "gap", detail: expect.stringContaining("Constancia de CUIT") }
    ]);
  });

  it("treats a document marked absent the same as an omitted one", () => {
    const omitted = checkCompleteness(
      input({ documents: [document("cuit", true), document("articles-of-incorporation", true)] })
    );
    const absent = checkCompleteness(
      input({
        documents: [
          document("sales-declarations", false),
          document("cuit", true),
          document("articles-of-incorporation", true)
        ]
      })
    );

    expect(omitted).toEqual(absent);
    expect(absent.findings[0]?.detail).toContain(COMPLETENESS_DOCUMENT_LABELS["sales-declarations"]);
  });

  it("reports every missing document in the canonical order", () => {
    const result = checkCompleteness(input({ documents: [document("cuit", true)] }));

    expect(codes(result.findings)).toEqual(["missing_document", "missing_document"]);
    expect(result.findings[0]?.detail).toContain(COMPLETENESS_DOCUMENT_LABELS["sales-declarations"]);
    expect(result.findings[1]?.detail).toContain(COMPLETENESS_DOCUMENT_LABELS["articles-of-incorporation"]);
  });

  it("reports zero photos as a gap", () => {
    const result = checkCompleteness(input({ photoCount: 0 }));

    expect(result.complete).toBe(false);
    expect(result.findings).toContainEqual({
      code: "insufficient_photos",
      severity: "gap",
      detail: expect.any(String)
    });
  });

  it("treats one to four photos as complete", () => {
    for (const photoCount of [1, 2, 4]) {
      expect(checkCompleteness(input({ photoCount })).complete).toBe(true);
    }
  });

  it("warns about more than four photos without blocking", () => {
    const result = checkCompleteness(input({ photoCount: 5 }));

    expect(result.complete).toBe(true);
    expect(result.findings).toEqual([
      { code: "insufficient_photos", severity: "warning", detail: expect.any(String) }
    ]);
  });

  it("reports one gap per month without a declared value", () => {
    const result = checkCompleteness(
      input({ salesMonths: months([3_100_000, null, 3_300_000, null, 3_400_000, null, 3_600_000, null]) })
    );

    const missing = result.findings.filter((finding) => finding.code === "missing_sales_month");
    expect(missing).toHaveLength(4);
    expect(missing.every((finding) => finding.severity === "gap")).toBe(true);
    expect(missing.map((finding) => finding.detail)).toEqual([
      expect.stringContaining("Febrero"),
      expect.stringContaining("Abril"),
      expect.stringContaining("Junio"),
      expect.stringContaining("Agosto")
    ]);
    expect(result.complete).toBe(false);
  });

  it("adds one aggregate gap when fewer than six months are declared overall", () => {
    const result = checkCompleteness(
      input({
        salesMonths: [
          { month: "Enero", valueArs: 3_100_000 },
          { month: "Febrero", valueArs: 3_200_000 },
          { month: "Marzo", valueArs: 3_300_000 },
          { month: "Abril", valueArs: 3_400_000 },
          { month: "Mayo", valueArs: 3_500_000 }
        ]
      })
    );

    const missing = result.findings.filter((finding) => finding.code === "missing_sales_month");
    expect(missing).toHaveLength(1);
    expect(missing[0]?.severity).toBe("gap");
    expect(result.complete).toBe(false);
  });

  it("does not report a sales month when six of eight have a value", () => {
    const result = checkCompleteness(input({ salesMonths: SIX_VALUED }));

    expect(codes(result.findings)).not.toContain("missing_sales_month");
  });

  it("counts a declared zero as a value, not a missing month", () => {
    const result = checkCompleteness(
      input({
        salesMonths: months([0, 3_200_000, 3_300_000, 3_400_000, 3_500_000, 3_600_000, null, null])
      })
    );

    expect(codes(result.findings)).not.toContain("missing_sales_month");
    expect(result.complete).toBe(true);
  });

  it("warns about a month above 1.5x the average of the positive months", () => {
    const result = checkCompleteness(
      input({
        salesMonths: months([100, 100, 100, 100, 100, 100, 100, 400])
      })
    );

    expect(result.complete).toBe(true);
    const anomalies = result.findings.filter((finding) => finding.code === "sales_anomaly");
    expect(anomalies).toEqual([
      { code: "sales_anomaly", severity: "warning", detail: expect.stringContaining("Agosto") }
    ]);
  });

  it("does not flag a month below 1.5x the average", () => {
    // Eight positive months average 106.25, so the threshold is 159.375 and 150
    // sits below it. The exact-threshold and just-above cases follow.
    const result = checkCompleteness(
      input({ salesMonths: months([100, 100, 100, 100, 100, 100, 100, 150]) })
    );

    expect(codes(result.findings)).not.toContain("sales_anomaly");
  });

  it("does not flag a month exactly at 1.5x the average", () => {
    // The average includes the candidate: positives [100, 300] average 200, so
    // the threshold is exactly 300 and the strict `>` rule leaves 300 unflagged.
    const result = checkCompleteness(
      input({ salesMonths: months([100, 300, 0, 0, 0, 0, 0, 0]) })
    );

    expect(codes(result.findings)).not.toContain("sales_anomaly");
  });

  it("flags a month just above 1.5x the average", () => {
    // Positives [100, 301] average 200.5, so the threshold is 300.75 and 301
    // clears it by 0.25 — the strict `>` boundary on the other side.
    const result = checkCompleteness(
      input({ salesMonths: months([100, 301, 0, 0, 0, 0, 0, 0]) })
    );

    const anomalies = result.findings.filter((finding) => finding.code === "sales_anomaly");
    expect(anomalies).toEqual([
      { code: "sales_anomaly", severity: "warning", detail: expect.stringContaining("Febrero") }
    ]);
  });

  it("stays a function of its input and never mutates it", () => {
    const subject = input();
    const snapshot = JSON.stringify(subject);

    checkCompleteness(subject);

    expect(JSON.stringify(subject)).toBe(snapshot);
  });
});

import type { ReviewFinding } from "@vaqcrow/contracts";
import { describe, expect, it } from "vitest";
import {
  contradictoryRequest,
  contradictorySalesPeriods
} from "@/application/fixtures/contradictory-request";
import { panaderiaHorizonte } from "@/application/fixtures/panaderia-horizonte";
import { deriveReviewFindings } from "./evidence-review";
import {
  BACKEND_PROVENANCE,
  backendPeriodsToEvidenced,
  buildEvidenceRegistry,
  buildReviewItems,
  demoReviewItems,
  formatArs,
  formatPeriodLabel,
  mapFindingsToReviewItems
} from "./review-mapper";

describe("formatPeriodLabel", () => {
  it("renders a Spanish month name and year", () => {
    expect(formatPeriodLabel("2026-01")).toBe("Enero 2026");
    expect(formatPeriodLabel("2026-04")).toBe("Abril 2026");
    expect(formatPeriodLabel("2025-12")).toBe("Diciembre 2025");
  });

  it("returns the raw value for anything that is not YYYY-MM instead of guessing", () => {
    expect(formatPeriodLabel("2026-13")).toBe("2026-13");
    expect(formatPeriodLabel("abril")).toBe("abril");
  });
});

describe("formatArs", () => {
  it("formats integer pesos with es-AR grouping", () => {
    expect(formatArs(12_000_000).replace(/\s/g, " ")).toBe("$ 12.000.000");
  });
});

describe("mapFindingsToReviewItems", () => {
  const registry = buildEvidenceRegistry(panaderiaHorizonte.sales);

  it("maps missing/anomalous findings with labels and evidence resolution, never inventing data", () => {
    const findings = deriveReviewFindings(
      { declaredTotalArs: 0 },
      panaderiaHorizonte.sales
    ).filter((f) => f.kind !== "contradictory");

    const items = mapFindingsToReviewItems({ findings, request: undefined, periods: panaderiaHorizonte.sales, registry });

    expect(items).toEqual([
      // April is missing: its evidence ref points at nothing, so it stays unresolved.
      { kind: "missing", periodLabel: "Abril 2026", evidence: { status: "unresolved", ref: "missing:2026-04" } },
      {
        kind: "anomalous",
        periodLabel: "Junio 2026",
        evidence: { status: "resolved", ref: "sales:2026-06", provenance: "Declaración mensual sintética" }
      }
    ]);
  });

  it("computes declared total and reported sum for contradictory findings", () => {
    const findings = deriveReviewFindings(contradictoryRequest, contradictorySalesPeriods);

    const [item] = mapFindingsToReviewItems({
      findings,
      request: contradictoryRequest,
      periods: contradictorySalesPeriods,
      registry: buildEvidenceRegistry(contradictorySalesPeriods)
    });

    expect(item?.kind).toBe("contradictory");
    expect(item?.declaredTotal?.replace(/\s/g, " ")).toBe("$ 12.000.000");
    expect(item?.reportedTotal?.replace(/\s/g, " ")).toBe("$ 9.700.000");
  });

  it("leaves totals undefined when the request is not available (no invention)", () => {
    const findings: ReviewFinding[] = [{ kind: "contradictory", messageKey: "review.finding.contradictory" }];

    const [item] = mapFindingsToReviewItems({ findings, request: undefined, periods: [], registry: {} });

    expect(item).toEqual({ kind: "contradictory" });
  });

  it("marks evidence unresolved for refs outside the registry and omits it when the finding has none", () => {
    const findings: ReviewFinding[] = [
      { kind: "anomalous", period: "2026-06", evidenceRef: "ghost:1", messageKey: "k" },
      { kind: "missing", period: "2026-04", messageKey: "k" }
    ];

    const items = mapFindingsToReviewItems({ findings, request: undefined, periods: [], registry: {} });

    expect(items[0]?.evidence).toEqual({ status: "unresolved", ref: "ghost:1" });
    expect(items[1]).toEqual({ kind: "missing", periodLabel: "Abril 2026" });
  });
});

describe("buildEvidenceRegistry", () => {
  it("registers only periods that carry data; a missing period has no evidence entry", () => {
    const registry = buildEvidenceRegistry(panaderiaHorizonte.sales);

    expect(registry["sales:2026-01"]).toEqual({ provenance: "Declaración mensual sintética" });
    expect(registry["missing:2026-04"]).toBeUndefined();
  });
});

describe("buildReviewItems", () => {
  it("derives findings and maps them in one step for a request", () => {
    const items = buildReviewItems(contradictoryRequest, contradictorySalesPeriods);

    expect(items.map((item) => item.kind)).toEqual(["contradictory"]);
  });

  it("without a request only period-level findings are produced (no total is invented)", () => {
    const items = buildReviewItems(null, panaderiaHorizonte.sales);

    expect(items.map((item) => item.kind)).toEqual(["missing", "anomalous"]);
  });
});

describe("demo fallback review", () => {
  it("combines the Panadería period findings with the contradictory fixture case", () => {
    expect(demoReviewItems.map((item) => item.kind)).toEqual(["missing", "anomalous", "contradictory"]);
    expect(demoReviewItems[2]?.declaredTotal).toBeDefined();
  });
});

describe("backendPeriodsToEvidenced", () => {
  it("adds a neutral provenance without inventing one per period", () => {
    const [period] = backendPeriodsToEvidenced([
      { period: "2026-01", amountArs: 1, status: "reported", evidenceRef: "e:1", simuladoLabel: "SIMULADO" }
    ]);

    expect(period?.provenance).toBe(BACKEND_PROVENANCE);
  });
});

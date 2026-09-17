import { describe, expect, it } from "vitest";
import {
  anomalousSalesPeriods,
  missingSalesPeriods,
  panaderiaHorizonte,
  reportedSalesTotalArs,
  SIMULADO_LABEL
} from "./panaderia-horizonte";

describe("panaderiaHorizonte", () => {
  it("identifies the fictional bakery, never a real KYC verification", () => {
    expect(panaderiaHorizonte.legalName).toBe("Panadería Horizonte SRL");
    expect(panaderiaHorizonte.kyc.status).toBe("Aprobado · SIMULADO");
  });

  it("carries the SIMULADO label on the entity and every sales period", () => {
    expect(panaderiaHorizonte.simuladoLabel).toBe(SIMULADO_LABEL);
    expect(panaderiaHorizonte.kyc.simuladoLabel).toBe(SIMULADO_LABEL);
    for (const period of panaderiaHorizonte.sales) {
      expect(period.simuladoLabel).toBe(SIMULADO_LABEL);
    }
  });

  it("has exactly 8 monthly periods spanning January to August 2026", () => {
    expect(panaderiaHorizonte.sales).toHaveLength(8);
    expect(panaderiaHorizonte.sales.map((period) => period.period)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08"
    ]);
  });

  it("represents April as missing, distinguishable from a reported zero", () => {
    const april = panaderiaHorizonte.sales.find((period) => period.period === "2026-04");

    expect(april?.status).toBe("missing");
    expect(april?.amountArs).toBeNull();
    expect(missingSalesPeriods()).toHaveLength(1);
    expect(missingSalesPeriods()[0]?.period).toBe("2026-04");
  });

  it("flags June as anomalous without asserting a cause", () => {
    const june = panaderiaHorizonte.sales.find((period) => period.period === "2026-06");

    expect(june?.status).toBe("anomalous");
    expect(june?.amountArs).not.toBeNull();
    expect(june?.note).toBeDefined();
    expect(june?.note?.toLowerCase()).not.toMatch(
      /porque|debido a|causad[ao] por|a raíz de|se debe a/
    );
    expect(anomalousSalesPeriods()).toHaveLength(1);
    expect(anomalousSalesPeriods()[0]?.period).toBe("2026-06");
  });

  it("has every other period reported with a positive amount", () => {
    const reported = panaderiaHorizonte.sales.filter((period) => period.status === "reported");

    expect(reported).toHaveLength(6);
    for (const period of reported) {
      expect(period.amountArs).toBeGreaterThan(0);
    }
  });

  it("computes a deterministic reported total that excludes only the missing month", () => {
    const expectedTotal = panaderiaHorizonte.sales.reduce(
      (total, period) => total + (period.amountArs ?? 0),
      0
    );

    expect(reportedSalesTotalArs()).toBe(expectedTotal);
    expect(reportedSalesTotalArs()).toBe(reportedSalesTotalArs());
  });

  it("is frozen and contains no seeds, private keys, or randomness/clock calls", () => {
    expect(Object.isFrozen(panaderiaHorizonte)).toBe(true);
    expect(Object.isFrozen(panaderiaHorizonte.sales)).toBe(true);

    const serialized = JSON.stringify(panaderiaHorizonte).toLowerCase();
    expect(serialized).not.toMatch(/seed|private[_-]?key|secret/);
  });
});

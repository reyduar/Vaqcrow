import { describe, expect, it } from "vitest";
import type { PortfolioPosition } from "@/application/ports/portfolio-port";
import { sectorBreakdown } from "./sectors";

function position(sector: string, contributionXlm: string): PortfolioPosition {
  return {
    campaignId: `id-${sector}-${contributionXlm}`,
    name: "PyME",
    sector,
    city: "Córdoba",
    imageSrc: null,
    contributionXlm,
    raisedArs: 0,
    goalArs: 1,
    fundedPercentBps: 0,
    status: "funding",
    closeDate: "2026-11-30T12:00:00.000Z",
    vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
    vaultExplorerUrl: null,
    transactions: []
  };
}

describe("sectorBreakdown", () => {
  it("sums per sector and sorts desc by amount, whole percents", () => {
    const rows = sectorBreakdown([
      position("Gastronomía", "400.0000000"),
      position("Alimentos", "250.0000000"),
      position("Comercio minorista", "200.0000000"),
      position("Alimentos", "100.0000000")
    ]);

    expect(rows).toEqual([
      { sector: "Gastronomía", percent: 42 },
      { sector: "Alimentos", percent: 37 },
      { sector: "Comercio minorista", percent: 21 }
    ]);
  });

  it("rounds to the nearest whole percent", () => {
    const rows = sectorBreakdown([
      position("A", "1.0000000"),
      position("B", "1.0000000"),
      position("C", "1.0000000")
    ]);

    expect(rows.map((row) => row.percent)).toEqual([33, 33, 33]);
  });

  it("returns an empty array for no positions", () => {
    expect(sectorBreakdown([])).toEqual([]);
  });

  it("returns an empty array when every contribution is zero", () => {
    expect(sectorBreakdown([position("A", "0.0000000"), position("B", "0.0000000")])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { PortfolioPosition } from "@/application/ports/portfolio-port";
import { sortPortfolioPositions } from "./sort";

function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    contributionXlm: "250.0000000",
    raisedArs: 9_450_000,
    goalArs: 15_000_000,
    fundedPercentBps: 6_300,
    status: "funding",
    closeDate: "2026-11-30T12:00:00.000Z",
    vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
    ...overrides
  };
}

const FUNDING = position({ campaignId: "a", name: "Fondeo", status: "funding" });
const SETTLED = position({ campaignId: "b", name: "Meta", status: "settled" });
const REFUNDING = position({ campaignId: "c", name: "Reembolso", status: "refunding" });

describe("sortPortfolioPositions", () => {
  it("preserves the API order for recent", () => {
    const input = [SETTLED, REFUNDING, FUNDING];
    expect(sortPortfolioPositions(input, "recent")).toEqual([SETTLED, REFUNDING, FUNDING]);
  });

  it("orders by status rank funding -> settled -> refunding for state", () => {
    const input = [REFUNDING, SETTLED, FUNDING];
    expect(sortPortfolioPositions(input, "state").map((p) => p.name)).toEqual(["Fondeo", "Meta", "Reembolso"]);
  });

  it("keeps the API order among ties for state (stable)", () => {
    const first = position({ campaignId: "1", name: "Primero", status: "funding" });
    const second = position({ campaignId: "2", name: "Segundo", status: "funding" });
    const third = position({ campaignId: "3", name: "Tercero", status: "funding" });
    expect(sortPortfolioPositions([first, second, third], "state").map((p) => p.name)).toEqual([
      "Primero",
      "Segundo",
      "Tercero"
    ]);
  });

  it("never mutates the input array", () => {
    const input = [REFUNDING, SETTLED, FUNDING];
    const snapshot = [...input];
    sortPortfolioPositions(input, "state");
    expect(input).toEqual(snapshot);
  });
});

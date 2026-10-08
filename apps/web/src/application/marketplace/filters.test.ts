import { describe, expect, it } from "vitest";
import type { MarketplaceCard } from "@/application/ports/marketplace-port";
import {
  activeFilterCount,
  CLOSE_ANY_DAYS,
  EMPTY_MARKETPLACE_FILTERS,
  filterMarketplaceCards,
  GOAL_ANY_MILLIONS,
  MARKETPLACE_SORT_OPTIONS,
  marketplaceCities,
  marketplaceResultCountLabel,
  marketplaceSectors,
  sortMarketplaceCards,
  type MarketplaceFilters
} from "./filters";

const TODAY = new Date("2026-10-08T00:00:00.000Z");

function card(overrides: Partial<MarketplaceCard> = {}): MarketplaceCard {
  return {
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    city: "Rosario",
    goalArs: 9_450_000,
    raisedArs: 5_954_000,
    fundedPercentBps: 6_300,
    revenueShare: 4.5,
    riskBand: "low",
    riskConfidence: 0.8,
    closeDate: "2026-11-07T00:00:00.000Z",
    imageSrc: null,
    ...overrides
  };
}

function filters(overrides: Partial<MarketplaceFilters> = {}): MarketplaceFilters {
  return { ...EMPTY_MARKETPLACE_FILTERS, ...overrides };
}

describe("EMPTY_MARKETPLACE_FILTERS", () => {
  it("is the any-value baseline", () => {
    expect(EMPTY_MARKETPLACE_FILTERS.risks).toEqual([]);
    expect(EMPTY_MARKETPLACE_FILTERS.sectors).toEqual([]);
    expect(EMPTY_MARKETPLACE_FILTERS.location).toBe("");
    expect(EMPTY_MARKETPLACE_FILTERS.goalMaxMillions).toBe(GOAL_ANY_MILLIONS);
    expect(EMPTY_MARKETPLACE_FILTERS.closeMaxDays).toBe(CLOSE_ANY_DAYS);
    expect(GOAL_ANY_MILLIONS).toBe(16);
    expect(CLOSE_ANY_DAYS).toBe(150);
  });
});

describe("MARKETPLACE_SORT_OPTIONS", () => {
  it("uses the exact template labels", () => {
    expect(MARKETPLACE_SORT_OPTIONS).toEqual([
      { value: "close", label: "Cierre más próximo" },
      { value: "funded", label: "Mayor porcentaje fondeado" },
      { value: "goal", label: "Menor meta" }
    ]);
  });
});

describe("activeFilterCount", () => {
  it("counts each active dimension", () => {
    expect(activeFilterCount(EMPTY_MARKETPLACE_FILTERS)).toBe(0);
    expect(activeFilterCount(filters({ risks: ["low", "high"], sectors: ["Alimentos"] }))).toBe(3);
    expect(activeFilterCount(filters({ location: "  Rosario  " }))).toBe(1);
    expect(activeFilterCount(filters({ goalMaxMillions: 10 }))).toBe(1);
    expect(activeFilterCount(filters({ closeMaxDays: 30 }))).toBe(1);
    expect(activeFilterCount(filters({ location: "   " }))).toBe(0);
  });
});

describe("filterMarketplaceCards", () => {
  it("matches text case-insensitively across name, sector and city", () => {
    const cards = [card(), card({ name: "Ferretería Sur", sector: "Retail", city: "Córdoba" })];
    const query = (text: string) => ({ text, filters: EMPTY_MARKETPLACE_FILTERS });

    expect(filterMarketplaceCards(cards, query("PANADER"), TODAY)).toHaveLength(1);
    expect(filterMarketplaceCards(cards, query("alimentos"), TODAY)).toHaveLength(1);
    expect(filterMarketplaceCards(cards, query("rosario"), TODAY)).toHaveLength(1);
    expect(filterMarketplaceCards(cards, query(""), TODAY)).toHaveLength(2);
  });

  it("excludes a null risk when risks are selected", () => {
    const cards = [card({ riskBand: "low" }), card({ riskBand: null })];
    const result = filterMarketplaceCards(cards, { text: "", filters: filters({ risks: ["low"] }) }, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0]!.riskBand).toBe("low");
  });

  it("filters by sector and location", () => {
    const cards = [card(), card({ name: "Ferretería Sur", sector: "Retail", city: "Córdoba" })];

    expect(filterMarketplaceCards(cards, { text: "", filters: filters({ sectors: ["Retail"] }) }, TODAY)).toHaveLength(1);
    expect(filterMarketplaceCards(cards, { text: "", filters: filters({ location: "CóR" }) }, TODAY)).toHaveLength(1);
  });

  it("applies the goal ceiling inclusively", () => {
    const cards = [card({ goalArs: 10_000_000 })];
    expect(filterMarketplaceCards(cards, { text: "", filters: filters({ goalMaxMillions: 10 }) }, TODAY)).toHaveLength(1);
    expect(filterMarketplaceCards(cards, { text: "", filters: filters({ goalMaxMillions: 9 }) }, TODAY)).toHaveLength(0);
  });

  it("applies the close window inclusively on the boundary day", () => {
    const inWindow = card({ closeDate: "2026-11-07T00:00:00.000Z" }); // exactly 30 days
    const outWindow = card({ closeDate: "2026-11-08T00:00:00.000Z" }); // 31 days
    const active = filters({ closeMaxDays: 30 });

    expect(filterMarketplaceCards([inWindow], { text: "", filters: active }, TODAY)).toHaveLength(1);
    expect(filterMarketplaceCards([outWindow], { text: "", filters: active }, TODAY)).toHaveLength(0);
  });

  it("excludes an invalid close date when the close filter is active", () => {
    const broken = card({ closeDate: "not-a-date" });
    expect(filterMarketplaceCards([broken], { text: "", filters: filters({ closeMaxDays: 30 }) }, TODAY)).toHaveLength(0);
    // The date is ignored when the close filter is inactive.
    expect(filterMarketplaceCards([broken], { text: "", filters: EMPTY_MARKETPLACE_FILTERS }, TODAY)).toHaveLength(1);
  });

  it("combines every dimension with AND", () => {
    const cards = [
      card(),
      card({ campaignId: "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", sector: "Retail", city: "Córdoba", riskBand: "high" })
    ];
    const active = filters({ risks: ["low"], sectors: ["Alimentos"], location: "rosario", goalMaxMillions: 10, closeMaxDays: 30 });
    const result = filterMarketplaceCards(cards, { text: "panader", filters: active }, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Panadería Horizonte SRL");
  });

  it("does not mutate the input array", () => {
    const cards = [card(), card({ name: "Ferretería Sur" })];
    const snapshot = [...cards];
    filterMarketplaceCards(cards, { text: "panader", filters: filters({ risks: ["low"] }) }, TODAY);
    expect(cards).toEqual(snapshot);
  });
});

describe("sortMarketplaceCards", () => {
  const cards = [
    card({ campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10", name: "A", closeDate: "2026-12-31T00:00:00.000Z", fundedPercentBps: 5_000, goalArs: 9_000_000 }),
    card({ campaignId: "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", name: "B", closeDate: "2026-11-01T00:00:00.000Z", fundedPercentBps: 9_000, goalArs: 3_000_000 }),
    card({ campaignId: "0b1c2d3e-4f50-4a1b-8c2d-3e4f5a6b7c8d", name: "C", closeDate: "2027-01-15T00:00:00.000Z", fundedPercentBps: 1_000, goalArs: 12_000_000 })
  ];

  it("sorts by closest close date ascending", () => {
    expect(sortMarketplaceCards(cards, "close").map((c) => c.name)).toEqual(["B", "A", "C"]);
  });

  it("sorts by funded percentage descending", () => {
    expect(sortMarketplaceCards(cards, "funded").map((c) => c.name)).toEqual(["B", "A", "C"]);
  });

  it("sorts by smallest goal ascending", () => {
    expect(sortMarketplaceCards(cards, "goal").map((c) => c.name)).toEqual(["B", "A", "C"]);
  });

  it("does not mutate the input array", () => {
    const snapshot = [...cards];
    sortMarketplaceCards(cards, "close");
    expect(cards).toEqual(snapshot);
  });
});

describe("marketplaceSectors", () => {
  it("returns distinct sectors with es collation", () => {
    const cards = [card({ sector: "Zapatería" }), card({ sector: "Alimentos" }), card({ sector: "Zapatería" }), card({ sector: "Bebidas" })];
    expect(marketplaceSectors(cards)).toEqual(["Alimentos", "Bebidas", "Zapatería"]);
  });
});

describe("marketplaceCities", () => {
  it("returns distinct cities", () => {
    const cards = [card({ city: "Rosario" }), card({ city: "Córdoba" }), card({ city: "Rosario" })];
    expect(marketplaceCities(cards)).toEqual(["Córdoba", "Rosario"]);
  });
});

describe("marketplaceResultCountLabel", () => {
  it("prefers the loading label while loading", () => {
    expect(marketplaceResultCountLabel(0, true)).toBe("Cargando…");
    expect(marketplaceResultCountLabel(7, true)).toBe("Cargando…");
  });

  it("uses the singular for exactly one result", () => {
    expect(marketplaceResultCountLabel(1, false)).toBe("1 PyME");
  });

  it("uses the plural for zero and many", () => {
    expect(marketplaceResultCountLabel(0, false)).toBe("0 PyMEs");
    expect(marketplaceResultCountLabel(5, false)).toBe("5 PyMEs");
  });
});

import { describe, expect, it } from "vitest";
import type { MarketplaceCard } from "@/application/ports/marketplace-port";
import { selectFeatured, selectGrid } from "./landing-selection";

/**
 * The landing's derived selection (Feature #418, WU2). The list comes straight
 * from the public contract, so every card is built from `MarketplaceCard` and
 * the module is asserted pure: it never mutates its input.
 */
function card(overrides: Partial<MarketplaceCard> & Pick<MarketplaceCard, "campaignId">): MarketplaceCard {
  return {
    name: "PyME de prueba",
    sector: "Sector",
    city: "Ciudad",
    goalArs: 10_000_000,
    raisedArs: null,
    fundedPercentBps: 0,
    revenueShare: 4,
    riskBand: null,
    riskConfidence: null,
    closeDate: "2030-01-01T00:00:00.000Z",
    imageSrc: null,
    ...overrides
  };
}

describe("selectFeatured", () => {
  it("returns null for an empty list", () => {
    expect(selectFeatured([])).toBeNull();
  });

  it("picks the campaign with the highest fundedPercentBps", () => {
    const low = card({ campaignId: "low", fundedPercentBps: 1_000 });
    const high = card({ campaignId: "high", fundedPercentBps: 9_000 });
    const mid = card({ campaignId: "mid", fundedPercentBps: 5_000 });

    expect(selectFeatured([low, high, mid])?.campaignId).toBe("high");
  });

  it("breaks a funded tie in favour of a campaign with an image", () => {
    const noImage = card({ campaignId: "no-image", fundedPercentBps: 8_000, imageSrc: null });
    const withImage = card({ campaignId: "with-image", fundedPercentBps: 8_000, imageSrc: "https://cdn.test/a.jpg" });

    expect(selectFeatured([noImage, withImage])?.campaignId).toBe("with-image");
    // Order must not matter: the image preference is a property of the pair.
    expect(selectFeatured([withImage, noImage])?.campaignId).toBe("with-image");
  });

  it("treats an empty image URL as no image", () => {
    const blank = card({ campaignId: "blank", fundedPercentBps: 8_000, imageSrc: "" });
    const withImage = card({ campaignId: "with-image", fundedPercentBps: 8_000, imageSrc: "https://cdn.test/a.jpg" });

    expect(selectFeatured([blank, withImage])?.campaignId).toBe("with-image");
  });

  it("breaks a funded+image tie by the earliest close date", () => {
    const later = card({
      campaignId: "later",
      fundedPercentBps: 8_000,
      imageSrc: "https://cdn.test/a.jpg",
      closeDate: "2030-12-01T00:00:00.000Z"
    });
    const earlier = card({
      campaignId: "earlier",
      fundedPercentBps: 8_000,
      imageSrc: "https://cdn.test/b.jpg",
      closeDate: "2030-10-01T00:00:00.000Z"
    });

    expect(selectFeatured([later, earlier])?.campaignId).toBe("earlier");
  });

  it("ranks a campaign with an unparseable close date last within a tie", () => {
    const invalid = card({
      campaignId: "invalid",
      fundedPercentBps: 8_000,
      imageSrc: "https://cdn.test/a.jpg",
      closeDate: "not-a-date"
    });
    const valid = card({
      campaignId: "valid",
      fundedPercentBps: 8_000,
      imageSrc: "https://cdn.test/b.jpg",
      closeDate: "2030-10-01T00:00:00.000Z"
    });

    expect(selectFeatured([invalid, valid])?.campaignId).toBe("valid");
  });

  it("does not mutate its input", () => {
    const cards = [card({ campaignId: "a", fundedPercentBps: 1_000 }), card({ campaignId: "b", fundedPercentBps: 9_000 })];
    const snapshot = [...cards];

    selectFeatured(cards);

    expect(cards).toEqual(snapshot);
  });
});

describe("selectGrid", () => {
  const featured = card({ campaignId: "featured", fundedPercentBps: 9_000 });
  const first = card({ campaignId: "first", closeDate: "2030-10-01T00:00:00.000Z" });
  const second = card({ campaignId: "second", closeDate: "2030-11-01T00:00:00.000Z" });
  const third = card({ campaignId: "third", closeDate: "2030-12-01T00:00:00.000Z" });
  const fourth = card({ campaignId: "fourth", closeDate: "2031-01-01T00:00:00.000Z" });

  it("excludes the featured campaign and sorts the rest by earliest close date", () => {
    const selection = selectGrid([second, featured, fourth, first, third], "featured");

    expect(selection.map((entry) => entry.campaignId)).toEqual(["first", "second", "third"]);
  });

  it("caps the grid at three cards by default", () => {
    const selection = selectGrid([fourth, third, second, first], null);

    expect(selection).toHaveLength(3);
    expect(selection.map((entry) => entry.campaignId)).toEqual(["first", "second", "third"]);
  });

  it("honours an explicit count", () => {
    const selection = selectGrid([fourth, third, second, first], null, 2);

    expect(selection.map((entry) => entry.campaignId)).toEqual(["first", "second"]);
  });

  it("keeps every card when there is no featured campaign", () => {
    const selection = selectGrid([second, first], null);

    expect(selection.map((entry) => entry.campaignId)).toEqual(["first", "second"]);
  });

  it("does not mutate its input", () => {
    const cards = [second, first];
    const snapshot = [...cards];

    selectGrid(cards, null);

    expect(cards).toEqual(snapshot);
  });
});

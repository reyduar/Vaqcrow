import { describe, expect, it } from "vitest";
import type { MarketplaceCard } from "@/application/ports/marketplace-port";
import { marketplaceCardViews, toMarketplaceCardView } from "./view-model";

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
    closeDate: "2026-11-30T12:00:00.000Z",
    imageSrc: "http://localhost:3000/marketplace/campaigns/3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10/image",
    ...overrides
  };
}

describe("toMarketplaceCardView", () => {
  it("composes the meta, amounts and labels", () => {
    const view = toMarketplaceCardView(card());

    expect(view.meta).toBe("Alimentos · Rosario");
    expect(view.goalLabel).toBe("ARS 9.450.000");
    expect(view.raisedLabel).toBe("ARS 5.954.000");
    expect(view.fundedPercent).toBe(63);
    expect(view.fundedLabel).toBe("63 % de la meta");
    expect(view.revenueShareLabel).toBe("4,5 % de ventas");
    expect(view.closeLabel).toBe("30/11/2026");
    expect(view.href).toBe("/campaigns/3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10");
    expect(view.ctaLabel).toBe("Ver evidencia y riesgo de Panadería Horizonte SRL");
  });

  it("labels an absent risk as 'Riesgo sin dato' with the neutral tone", () => {
    const view = toMarketplaceCardView(card({ riskBand: null, riskConfidence: null }));
    expect(view.riskBand).toBeNull();
    expect(view.riskLabel).toBe("Riesgo sin dato");
    expect(view.riskTone).toBe("neutral");
  });

  it("maps each risk band to an exact label and tone", () => {
    expect(toMarketplaceCardView(card({ riskBand: "low" }))).toMatchObject({ riskLabel: "Riesgo bajo", riskTone: "info" });
    expect(toMarketplaceCardView(card({ riskBand: "medium" }))).toMatchObject({ riskLabel: "Riesgo medio", riskTone: "caution" });
    expect(toMarketplaceCardView(card({ riskBand: "high" }))).toMatchObject({ riskLabel: "Riesgo alto", riskTone: "critical" });
  });

  it("renders a missing raised amount as 'Sin dato', never zero", () => {
    const view = toMarketplaceCardView(card({ raisedArs: null }));
    expect(view.raisedLabel).toBe("Sin dato");
    expect(view.raisedLabel).not.toBe("0");
    expect(view.raisedLabel).not.toBe("ARS 0");
  });

  it("uses an empty alt text when there is no image", () => {
    expect(toMarketplaceCardView(card({ imageSrc: null })).imageAlt).toBe("");
    expect(toMarketplaceCardView(card()).imageAlt).toBe("Foto de Panadería Horizonte SRL");
  });
});

describe("marketplaceCardViews", () => {
  it("maps every card", () => {
    const views = marketplaceCardViews([
      card(),
      card({ campaignId: "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", name: "Ferretería Sur" })
    ]);
    expect(views).toHaveLength(2);
    expect(views[1]!.name).toBe("Ferretería Sur");
  });
});

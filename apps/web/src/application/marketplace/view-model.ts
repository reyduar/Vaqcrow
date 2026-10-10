import type { RiskBand } from "@vaqcrow/contracts";
import type { MarketplaceCard } from "@/application/ports/marketplace-port";
import {
  formatArsAmount,
  formatCloseDate,
  formatFundedPercentLabel,
  formatRevenueSharePercent,
  fundedPercent
} from "./format";

/**
 * The presentational view of a marketplace card (Feature #414, WU4a).
 * React-free: it produces the exact strings and tones the card component will
 * render, so the copy lives in one place and no label is re-derived in JSX.
 *
 * The risk label is always visible text (never color alone, `docs/design/
 * demo-ui.md` §2); the tone is a secondary hint for the badge styling.
 */

export type MarketplaceRiskTone = "info" | "caution" | "critical" | "neutral";

const RISK_LABELS: Readonly<Record<RiskBand, string>> = Object.freeze({
  low: "Riesgo bajo",
  medium: "Riesgo medio",
  high: "Riesgo alto"
});

const RISK_TONES: Readonly<Record<RiskBand, MarketplaceRiskTone>> = Object.freeze({
  low: "info",
  medium: "caution",
  high: "critical"
});

export interface MarketplaceCardView {
  readonly campaignId: string;
  readonly name: string;
  /** `${sector} · ${city}`. */
  readonly meta: string;
  readonly imageSrc: string | null;
  /** Empty when there is no image, so the DOM never announces a missing photo. */
  readonly imageAlt: string;
  readonly riskBand: RiskBand | null;
  readonly riskLabel: string;
  readonly riskTone: MarketplaceRiskTone;
  readonly goalLabel: string;
  readonly raisedLabel: string;
  readonly fundedPercent: number;
  readonly fundedLabel: string;
  readonly revenueShareLabel: string;
  readonly closeLabel: string;
  readonly ctaLabel: string;
  /**
   * PROVISIONAL: the campaign detail route is #422. This href is the agreed
   * shape until that issue lands; WU4b links the card here.
   */
  readonly href: string;
}

export function toMarketplaceCardView(card: MarketplaceCard): MarketplaceCardView {
  const { riskBand } = card;
  return {
    campaignId: card.campaignId,
    name: card.name,
    meta: `${card.sector} · ${card.city}`,
    imageSrc: card.imageSrc,
    imageAlt: card.imageSrc ? `Foto de ${card.name}` : "",
    riskBand,
    riskLabel: riskBand ? RISK_LABELS[riskBand] : "Riesgo sin dato",
    riskTone: riskBand ? RISK_TONES[riskBand] : "neutral",
    goalLabel: formatArsAmount(card.goalArs),
    // A missing raised amount is "Sin dato", never "0" or "ARS 0".
    raisedLabel: card.raisedArs === null ? "Sin dato" : formatArsAmount(card.raisedArs),
    fundedPercent: fundedPercent(card.fundedPercentBps),
    fundedLabel: formatFundedPercentLabel(card.fundedPercentBps),
    revenueShareLabel: formatRevenueSharePercent(card.revenueShare),
    closeLabel: formatCloseDate(card.closeDate),
    ctaLabel: `Ver evidencia y riesgo de ${card.name}`,
    href: `/campaigns/${card.campaignId}`
  };
}

export function marketplaceCardViews(cards: readonly MarketplaceCard[]): readonly MarketplaceCardView[] {
  return cards.map(toMarketplaceCardView);
}

import type { MarketplaceCard } from "@/application/ports/marketplace-port";

/**
 * The landing's derived marketplace selection (Feature #418, WU2; owner
 * decision Q1, 2026-10-10). Pure and React-free — the client island owns the
 * fetch and passes the public list in, so this stays a trivial unit to test.
 *
 * The featured campaign is the one with the most funding: the highest
 * `fundedPercentBps`, then (only on a tie) a campaign that actually has a
 * photo, then the earliest close date. When there is no campaign the featured
 * slot falls back to the simulated example, which is a presentation concern
 * and is not modelled here. The grid is every published campaign, soonest to
 * close — the featured one included (#533): the hero's card is its own island
 * and never removes a live campaign from 「PyMEs en campaña」.
 */

/** An unparseable `closeDate` ranks last, never first: it cannot honestly win "earliest". */
function closeDateMs(card: MarketplaceCard): number {
  const ms = Date.parse(card.closeDate);
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

function hasImage(card: MarketplaceCard): boolean {
  return card.imageSrc !== null && card.imageSrc !== "";
}

function compareFeatured(a: MarketplaceCard, b: MarketplaceCard): number {
  if (a.fundedPercentBps !== b.fundedPercentBps) return b.fundedPercentBps - a.fundedPercentBps;
  const imageRank = Number(hasImage(b)) - Number(hasImage(a));
  if (imageRank !== 0) return imageRank;
  return closeDateMs(a) - closeDateMs(b);
}

/** The single campaign the landing features, or `null` when the list is empty. */
export function selectFeatured(cards: readonly MarketplaceCard[]): MarketplaceCard | null {
  return cards.reduce<MarketplaceCard | null>((best, card) => {
    if (best === null) return card;
    return compareFeatured(card, best) < 0 ? card : best;
  }, null);
}

/**
 * Up to `count` grid cards, soonest close first. Every published campaign is
 * eligible, the featured one included (#533). Returns a fresh array; the input
 * is never sorted or mutated.
 */
export function selectGrid(cards: readonly MarketplaceCard[], count = 3): readonly MarketplaceCard[] {
  return [...cards].sort((a, b) => closeDateMs(a) - closeDateMs(b)).slice(0, count);
}

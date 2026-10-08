import type { RiskBand } from "@vaqcrow/contracts";
import type { MarketplaceCard } from "@/application/ports/marketplace-port";

/**
 * The Explorar PyMEs filter/sort model (Feature #414, WU4a). React-free: the UI
 * in WU4b owns the controls and passes this pure state down.
 *
 * The semantics are the template's `filt`, adapted to the API shape: text is
 * case-insensitive across name, sector and city; each selected facet is an AND;
 * and `goal`/`close` use a "sentinel = any" ceiling so the default is always the
 * fully-open set.
 */

export type MarketplaceSort = "close" | "funded" | "goal";

/** The template's sort control, verbatim. */
export const MARKETPLACE_SORT_OPTIONS: readonly { readonly value: MarketplaceSort; readonly label: string }[] = Object.freeze([
  { value: "close", label: "Cierre más próximo" },
  { value: "funded", label: "Mayor porcentaje fondeado" },
  { value: "goal", label: "Menor meta" }
]);

/** `goalMaxMillions` sentinel: `16` means "sin límite de meta". */
export const GOAL_ANY_MILLIONS = 16;

/** `closeMaxDays` sentinel: `150` means "sin límite de cierre". */
export const CLOSE_ANY_DAYS = 150;

export interface MarketplaceFilters {
  readonly risks: readonly RiskBand[];
  readonly sectors: readonly string[];
  readonly location: string;
  /** `GOAL_ANY_MILLIONS` means "any goal". */
  readonly goalMaxMillions: number;
  /** `CLOSE_ANY_DAYS` means "any close date". */
  readonly closeMaxDays: number;
}

/** The fully-open baseline: every dimension is "any". */
export const EMPTY_MARKETPLACE_FILTERS: MarketplaceFilters = Object.freeze({
  risks: Object.freeze([]) as readonly RiskBand[],
  sectors: Object.freeze([]) as readonly string[],
  location: "",
  goalMaxMillions: GOAL_ANY_MILLIONS,
  closeMaxDays: CLOSE_ANY_DAYS
});

export interface MarketplaceQuery {
  readonly text: string;
  readonly filters: MarketplaceFilters;
}

/**
 * How many facet dimensions are narrowed, for the "Filtros (n)" affordance.
 * Free text is not a facet and is deliberately excluded.
 */
export function activeFilterCount(filters: MarketplaceFilters): number {
  return (
    filters.risks.length +
    filters.sectors.length +
    (filters.location.trim() ? 1 : 0) +
    (filters.goalMaxMillions < GOAL_ANY_MILLIONS ? 1 : 0) +
    (filters.closeMaxDays < CLOSE_ANY_DAYS ? 1 : 0)
  );
}

const MS_PER_DAY = 86_400_000;

/**
 * Applies the text search and every active facet with AND semantics. `today` is
 * injected so the close window is deterministic and testable. An unparseable
 * `closeDate` is excluded while the close filter is active (it cannot honestly
 * satisfy a window), and kept when the filter is open.
 */
export function filterMarketplaceCards(
  cards: readonly MarketplaceCard[],
  query: MarketplaceQuery,
  today: Date
): readonly MarketplaceCard[] {
  const text = query.text.trim().toLowerCase();
  const { filters } = query;
  const location = filters.location.trim().toLowerCase();
  const hasRisks = filters.risks.length > 0;
  const hasSectors = filters.sectors.length > 0;
  const hasGoal = filters.goalMaxMillions < GOAL_ANY_MILLIONS;
  const hasClose = filters.closeMaxDays < CLOSE_ANY_DAYS;
  const goalCeilingArs = filters.goalMaxMillions * 1_000_000;
  const todayMs = today.getTime();

  return cards.filter((card) => {
    if (text.length > 0) {
      const haystack = `${card.name} ${card.sector} ${card.city}`.toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    if (hasRisks) {
      if (card.riskBand === null || !filters.risks.includes(card.riskBand)) return false;
    }
    if (hasSectors) {
      if (!filters.sectors.includes(card.sector)) return false;
    }
    if (location.length > 0) {
      if (!card.city.toLowerCase().includes(location)) return false;
    }
    if (hasGoal) {
      if (card.goalArs > goalCeilingArs) return false;
    }
    if (hasClose) {
      const closeMs = Date.parse(card.closeDate);
      if (Number.isNaN(closeMs)) return false;
      if ((closeMs - todayMs) / MS_PER_DAY > filters.closeMaxDays) return false;
    }
    return true;
  });
}

/** Returns a sorted copy; never mutates the input. */
export function sortMarketplaceCards(cards: readonly MarketplaceCard[], sort: MarketplaceSort): readonly MarketplaceCard[] {
  const copy = [...cards];
  if (sort === "close") {
    copy.sort((a, b) => Date.parse(a.closeDate) - Date.parse(b.closeDate));
  } else if (sort === "funded") {
    copy.sort((a, b) => b.fundedPercentBps - a.fundedPercentBps);
  } else {
    copy.sort((a, b) => a.goalArs - b.goalArs);
  }
  return copy;
}

/** Distinct sectors, es-AR collated, for the sector facet. */
export function marketplaceSectors(cards: readonly MarketplaceCard[]): readonly string[] {
  const set = new Set<string>();
  for (const card of cards) set.add(card.sector);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** Distinct cities, es-AR collated, for the location datalist. */
export function marketplaceCities(cards: readonly MarketplaceCard[]): readonly string[] {
  const set = new Set<string>();
  for (const card of cards) set.add(card.city);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** "Cargando…" | "1 PyME" | `${count} PyMEs`. */
export function marketplaceResultCountLabel(count: number, isLoading: boolean): string {
  if (isLoading) return "Cargando…";
  if (count === 1) return "1 PyME";
  return `${count} PyMEs`;
}

"use client";

import { useState } from "react";
import type { RiskBand } from "@vaqcrow/contracts";
import { useRouter } from "next/navigation";
import {
  IoCloseOutline,
  IoFunnelOutline,
  IoHeart,
  IoHeartOutline,
  IoOptionsOutline,
  IoSearchOutline
} from "react-icons/io5";
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
  type MarketplaceFilters,
  type MarketplaceSort
} from "@/application/marketplace/filters";
import { marketplaceCardViews, type MarketplaceCardView } from "@/application/marketplace/view-model";
import type { FavoritePort } from "@/application/ports/favorite-port";
import type { MarketplacePort } from "@/application/ports/marketplace-port";
import { createBrowserFavoritePort } from "@/infrastructure/marketplace/create-favorite-port";
import { createBrowserMarketplacePort } from "@/infrastructure/marketplace/create-marketplace-port";
import { useSession } from "@/state/session-store-provider";
import { useFavorites } from "@/state/use-favorites";
import { useMarketplace } from "@/state/use-marketplace";
import { CampaignCard } from "../campaign-card";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";
import { PageHeading } from "../page-heading";
import { ProgressBar } from "../progress-bar";
import { Select } from "../select";
import { Skeleton } from "../skeleton";
import { MarketplaceFavoriteHeart } from "./marketplace-favorite-heart";
import { MARKETPLACE_FILTERS_DIALOG_ID, MarketplaceFiltersModal } from "./marketplace-filters-modal";

/**
 * Explorar PyMEs (Feature #414, WU4b/WU5) — the public marketplace grid. The
 * controller is pure: it takes its ports as props (the container injects the
 * browser ones) so tests never touch the network or the session store. The
 * grid is public by owner decision (issue #414): the template's "Ingresá para
 * explorar PyMEs" gate does not apply and is never rendered.
 *
 * The favorite heart is visible to everyone (owner, 2026-10-08): a signed-in
 * visitor toggles the server favorite, while an anonymous one is sent to
 * `/login?returnTo=/explore`. Favorites are per account, so the "Mis favoritos"
 * toggle and the favorites-only chip exist only once signed in.
 *
 * Filtering and sorting are the pure `application/marketplace` functions; this
 * component owns only the control state and never re-derives a label.
 */

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/**
 * "Mis favoritos" toggle (template `Vaqcrow Explorar PyMEs.dc.html:113`): a
 * 44 px pill whose `favBtnBg`/`favBtnBorder` turn to the accent tint/text while
 * the favorites-only view is active. The count badge reuses the surface/border
 * treatment (`favBtnBg`'s sibling in the template).
 */
const FAVORITES_BUTTON_BASE =
  "inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-control px-4 text-sm font-semibold text-text-primary";
const FAVORITES_BUTTON_ON = "border border-brand-accent-text bg-brand-accent-tint";
const FAVORITES_BUTTON_OFF = "border border-control bg-transparent";

const SEARCH_PLACEHOLDER = "Buscá por nombre, sector o ciudad";
/** Template `Vaqcrow Explorar PyMEs.dc.html:249`: visible text; the name goes in `aria-label`. */
const CARD_CTA_LABEL = "Ver evidencia y riesgo";

const RISK_LABEL: Readonly<Record<RiskBand, string>> = {
  low: "bajo",
  medium: "medio",
  high: "alto"
};

const TITLE = "Explorar PyMEs";
const SUBTITLE =
  "Campañas de revenue share con riesgo explícito y evidencia verificable. Todos los casos son sintéticos y operan con activos de prueba sin valor económico.";

interface FilterChipDescriptor {
  readonly key: string;
  readonly label: string;
  readonly ariaLabel: string;
  readonly onRemove: () => void;
}

function FilterChip({ label, ariaLabel, onRemove }: Omit<FilterChipDescriptor, "key">) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onRemove}
      className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-pill border border-brand-accent-text bg-brand-accent-tint px-2 pl-3 text-[13px] font-semibold text-text-primary ${FOCUS_RING}`}
    >
      {label}
      <IoCloseOutline aria-hidden="true" focusable="false" className="text-[16px]" />
    </button>
  );
}

function MarketplaceProgress({ view }: { readonly view: MarketplaceCardView }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-text-secondary">Meta {view.goalLabel}</div>
      <ProgressBar label="Fondeado" value={view.fundedPercent} goal={100} formatValue={() => view.raisedLabel} />
      <div className="text-[13px] font-semibold">{view.fundedLabel}</div>
    </div>
  );
}

export interface ExploreMarketplaceProps {
  readonly signedIn: boolean;
  readonly marketplacePort?: MarketplacePort;
  readonly favoritePort?: FavoritePort;
}

export function ExploreMarketplace({ signedIn, marketplacePort, favoritePort }: ExploreMarketplaceProps) {
  const router = useRouter();
  // Captured once: an omitted prop stays null (the container injects the
  // browser port), so a test can inject fakes and nothing re-creates a port.
  const [port] = useState(() => marketplacePort ?? null);
  const [favoriteEndpoint] = useState(() => favoritePort ?? null);

  const marketplace = useMarketplace(port);
  const favorites = useFavorites(favoriteEndpoint, signedIn);

  const [text, setText] = useState("");
  const [filters, setFilters] = useState<MarketplaceFilters>(EMPTY_MARKETPLACE_FILTERS);
  const [sort, setSort] = useState<MarketplaceSort>("close");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [today] = useState(() => new Date());

  const cards = marketplace.items;
  const sectors = marketplaceSectors(cards);
  const cities = marketplaceCities(cards);

  const filtered = filterMarketplaceCards(
    cards,
    { text, filters, ...(onlyFavorites ? { onlyFavorites: true } : {}) },
    today,
    favorites.campaignIds
  );
  const sorted = sortMarketplaceCards(filtered, sort);
  const views = marketplaceCardViews(sorted);
  const filterCount = activeFilterCount(filters);

  const clearAll = () => {
    setText("");
    setFilters(EMPTY_MARKETPLACE_FILTERS);
    setOnlyFavorites(false);
  };

  const chips: FilterChipDescriptor[] = [];
  const trimmedText = text.trim();
  if (trimmedText) {
    chips.push({
      key: "text",
      label: `“${trimmedText}”`,
      ariaLabel: "Quitar búsqueda",
      onRemove: () => setText("")
    });
  }
  for (const risk of filters.risks) {
    chips.push({
      key: `risk-${risk}`,
      label: `Riesgo ${RISK_LABEL[risk]}`,
      ariaLabel: `Quitar filtro riesgo ${RISK_LABEL[risk]}`,
      onRemove: () => setFilters((current) => ({ ...current, risks: current.risks.filter((entry) => entry !== risk) }))
    });
  }
  for (const sector of filters.sectors) {
    chips.push({
      key: `sector-${sector}`,
      label: sector,
      ariaLabel: `Quitar filtro ${sector}`,
      onRemove: () =>
        setFilters((current) => ({ ...current, sectors: current.sectors.filter((entry) => entry !== sector) }))
    });
  }
  if (filters.location.trim()) {
    chips.push({
      key: "location",
      label: filters.location.trim(),
      ariaLabel: "Quitar filtro de localización",
      onRemove: () => setFilters((current) => ({ ...current, location: "" }))
    });
  }
  if (filters.goalMaxMillions < GOAL_ANY_MILLIONS) {
    chips.push({
      key: "goal",
      label: `Meta hasta ${filters.goalMaxMillions} M`,
      ariaLabel: "Quitar filtro de meta",
      onRemove: () => setFilters((current) => ({ ...current, goalMaxMillions: GOAL_ANY_MILLIONS }))
    });
  }
  if (filters.closeMaxDays < CLOSE_ANY_DAYS) {
    chips.push({
      key: "close",
      label: `Cierra en ${filters.closeMaxDays} días`,
      ariaLabel: "Quitar filtro de cierre",
      onRemove: () => setFilters((current) => ({ ...current, closeMaxDays: CLOSE_ANY_DAYS }))
    });
  }
  if (onlyFavorites) {
    chips.push({
      key: "favorites",
      label: "Solo favoritos",
      ariaLabel: "Quitar filtro de favoritos",
      onRemove: () => setOnlyFavorites(false)
    });
  }

  const FavIcon = onlyFavorites ? IoHeart : IoHeartOutline;
  // Favorites are per account (WU2), so the toggle only exists once signed in;
  // an anonymous visitor keeps none.
  const favoritesToggle = signedIn ? (
    <button
      type="button"
      aria-pressed={onlyFavorites}
      onClick={() => setOnlyFavorites((active) => !active)}
      className={`${FAVORITES_BUTTON_BASE} ${onlyFavorites ? FAVORITES_BUTTON_ON : FAVORITES_BUTTON_OFF} ${FOCUS_RING}`}
    >
      <FavIcon aria-hidden="true" focusable="false" className="text-[18px] text-brand-accent-text" />
      Mis favoritos
      <span className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-pill border border-border bg-page-surface px-1.5 text-xs">
        {favorites.campaignIds.size}
      </span>
    </button>
  ) : null;

  return (
    <>
      <PageHeading title={TITLE} subtitle={SUBTITLE} {...(favoritesToggle ? { action: favoritesToggle } : {})} />

      <div className="flex flex-wrap gap-3">
        <div
          role="search"
          className="flex h-12 min-w-[320px] flex-[1_1_320px] items-center gap-2.5 rounded-control border border-control bg-canvas px-3.5"
        >
          <IoSearchOutline aria-hidden="true" focusable="false" className="shrink-0 text-[19px] text-text-secondary" />
          <input
            type="search"
            aria-label="Buscar PyMEs"
            placeholder={SEARCH_PLACEHOLDER}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="flex-1 border-0 bg-transparent text-text-primary outline-none"
          />
        </div>

        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls={MARKETPLACE_FILTERS_DIALOG_ID}
          onClick={() => setFiltersOpen((open) => !open)}
          className={`flex h-12 cursor-pointer items-center gap-2 rounded-control border-0 bg-text-primary px-[18px] text-[15px] font-semibold text-canvas ${FOCUS_RING}`}
        >
          <IoOptionsOutline aria-hidden="true" focusable="false" className="text-[19px]" />
          Filtros
          {filterCount > 0 ? (
            <span className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-pill bg-brand-accent px-1.5 text-xs text-on-accent">
              {filterCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <FilterChip key={chip.key} label={chip.label} ariaLabel={chip.ariaLabel} onRemove={chip.onRemove} />
          ))}
          {chips.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className={`h-8 cursor-pointer border-0 bg-transparent px-2.5 text-[13px] font-semibold text-brand-accent-text underline underline-offset-[3px] ${FOCUS_RING}`}
            >
              Limpiar filtros
            </button>
          ) : null}
          <span aria-live="polite" className="text-sm text-text-secondary">
            {marketplaceResultCountLabel(views.length, marketplace.isLoading)}
          </span>
        </div>

        <Select
          label="Ordenar por"
          options={MARKETPLACE_SORT_OPTIONS}
          value={sort}
          onChange={(value) => {
            if (value) setSort(value as MarketplaceSort);
          }}
        />
      </div>

      <MarketplaceFiltersModal
        isOpen={filtersOpen}
        filters={filters}
        sectors={sectors}
        cities={cities}
        cards={cards}
        today={today}
        text={text}
        onApply={setFilters}
        onClose={() => setFiltersOpen(false)}
      />

      {marketplace.isLoading ? (
        <div
          role="status"
          aria-label="Cargando campañas"
          className="grid gap-6"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}
        >
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} shapes={["card"]} label="Cargando campaña" />
          ))}
        </div>
      ) : marketplace.loadFailed ? (
        <ErrorState
          title="No pudimos cargar las campañas"
          message="El servicio no respondió. Ningún dato ni aporte se modificó."
          onRetry={marketplace.reload}
          retryLabel="Reintentar"
        />
      ) : views.length === 0 ? (
        onlyFavorites && favorites.campaignIds.size === 0 ? (
          <EmptyState
            title="Todavía no guardaste favoritos"
            body="Tocá el corazón de una campaña para seguirla desde acá."
            action={{ label: "Limpiar filtros y búsqueda", onPress: clearAll }}
            icon={IoHeartOutline}
          />
        ) : (
          <EmptyState
            title="Ninguna campaña coincide"
            body="Probá quitar algún filtro o ampliar el plazo de cierre. Los filtros de riesgo y sector suelen ser los más restrictivos."
            action={{ label: "Limpiar filtros y búsqueda", onPress: clearAll }}
            icon={IoFunnelOutline}
          />
        )
      ) : (
        <ul
          aria-label="Resultados"
          className="m-0 grid list-none gap-6 p-0"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}
        >
          {views.map((view) => (
            <li key={view.campaignId} className="flex">
              <CampaignCard
                smeName={view.name}
                subtitle={view.meta}
                {...(view.imageSrc ? { image: { src: view.imageSrc, alt: view.imageAlt } } : {})}
                overlayAction={
                  <MarketplaceFavoriteHeart
                    isFavorite={signedIn && favorites.campaignIds.has(view.campaignId)}
                    name={view.name}
                    onToggle={() => {
                      // The heart is visible to everyone: a signed-in visitor
                      // toggles the server favorite, an anonymous one is sent
                      // to sign in and returns here afterwards.
                      if (signedIn) void favorites.toggle(view.campaignId);
                      else router.push("/login?returnTo=/explore");
                    }}
                  />
                }
                progressSlot={<MarketplaceProgress view={view} />}
                revenueShareTerms={view.revenueShareLabel}
                closeDateLabel={view.closeLabel}
                riskLevel={view.riskBand}
                riskLabel={view.riskLabel}
                simuladoLabel="SIMULADO"
                action={{ label: CARD_CTA_LABEL, ariaLabel: view.ctaLabel, href: view.href }}
                headingLevel={3}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The browser-wired entry point: the public `/explore` route mounts this. */
export function ExploreMarketplaceContainer() {
  const [marketplacePort] = useState(() => createBrowserMarketplacePort());
  const [favoritePort] = useState(() => createBrowserFavoritePort());
  const signedIn = useSession((state) => state.status === "signed-in");

  return <ExploreMarketplace signedIn={signedIn} marketplacePort={marketplacePort} favoritePort={favoritePort} />;
}

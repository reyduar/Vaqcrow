"use client";

import { useState } from "react";
import Link from "next/link";
import { IoArrowForwardOutline } from "react-icons/io5";
import { selectFeatured, selectGrid } from "@/application/marketplace/landing-selection";
import { marketplaceCardViews, type MarketplaceCardView } from "@/application/marketplace/view-model";
import type { MarketplaceCard, MarketplacePort } from "@/application/ports/marketplace-port";
import { createBrowserMarketplacePort } from "@/infrastructure/marketplace/create-marketplace-port";
import { useMarketplace } from "@/state/use-marketplace";
import { CampaignCard } from "../campaign-card";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";
import { ProgressBar } from "../progress-bar";
import { Skeleton } from "../skeleton";

/**
 * 「PyMEs en campaña」 — the landing's grid island (Feature #418, WU2). It is
 * the second of the landing's two client islands (the featured card is the
 * first, rendered inside the hero). It reuses the public `/explore` data path —
 * `createBrowserMarketplacePort()` + `useMarketplace` (SWR, one key shared with
 * the featured island, so the request is deduped) — never a new mechanism, and
 * derives the grid with the pure `landing-selection` module: the featured
 * campaign is excluded and the rest are shown soonest-to-close first.
 *
 * Loading and failure never throw: a failed read is surfaced with the same copy
 * `/explore` uses, and the grid simply has no cards.
 */

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const SECTION_TITLE = "PyMEs en campaña";
const SECTION_SUBTITLE = "Casos sintéticos de la demo · ordenados por fecha de cierre más próxima";
const MARKETPLACE_LINK = "Ver el marketplace";
const CARD_CTA_LABEL = "Ver evidencia y riesgo";

/**
 * Explore's grid shares this funding block, but it is not exported from
 * `marketplace/explore-marketplace.tsx`; this is the same treatment ("Meta" +
 * funded bar + funded label) so the two grids read identically.
 */
function LandingCardProgress({ view }: { readonly view: MarketplaceCardView }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-text-secondary">Meta {view.goalLabel}</div>
      <ProgressBar label="Fondeado" value={view.fundedPercent} goal={100} formatValue={() => view.raisedLabel} />
      <div className="text-[13px] font-semibold">{view.fundedLabel}</div>
    </div>
  );
}

interface GridProps {
  readonly cards: readonly MarketplaceCard[];
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  readonly onRetry: () => void;
}

function CampaignGrid({ cards, isLoading, loadFailed, onRetry }: GridProps) {
  const views = marketplaceCardViews(cards);

  return (
    <section
      aria-labelledby="mk-t"
      className="mx-auto flex w-full max-w-[1264px] flex-col gap-8 px-8 pt-24 pb-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex flex-col gap-2">
          <h2 id="mk-t" className="m-0 text-[40px] leading-[1.15] font-bold tracking-[-0.025em]">
            {SECTION_TITLE}
          </h2>
          <p className="m-0 text-base text-text-secondary">{SECTION_SUBTITLE}</p>
        </div>
        <Link href="/explore" className={`inline-flex h-11 items-center gap-1.5 text-[15px] font-semibold ${FOCUS_RING}`}>
          {MARKETPLACE_LINK}
          <IoArrowForwardOutline aria-hidden="true" focusable="false" className="text-[16px]" />
        </Link>
      </div>

      {isLoading ? (
        <div
          role="status"
          aria-label="Cargando campañas"
          className="grid gap-6"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }}
        >
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} shapes={["card"]} label="Cargando campaña" />
          ))}
        </div>
      ) : loadFailed ? (
        <ErrorState
          title="No pudimos cargar las campañas"
          message="El servicio no respondió. Ningún dato ni aporte se modificó."
          onRetry={onRetry}
          retryLabel="Reintentar"
        />
      ) : views.length === 0 ? (
        // The landing has no filters, so this is a neutral, honest empty — not
        // `/explore`'s filter-oriented copy, which only makes sense there.
        <EmptyState
          title="Todavía no hay campañas publicadas"
          body="Cuando una PyME publique su campaña, va a aparecer acá."
        />
      ) : (
        <ul
          aria-label="Campañas"
          className="m-0 grid list-none gap-6 p-0"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }}
        >
          {views.map((view) => (
            <li key={view.campaignId} className="flex">
              <CampaignCard
                smeName={view.name}
                subtitle={view.meta}
                {...(view.imageSrc ? { image: { src: view.imageSrc, alt: view.imageAlt } } : {})}
                progressSlot={<LandingCardProgress view={view} />}
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
    </section>
  );
}

export interface PymesEnCampanaProps {
  /** Injected by tests; production uses the browser port. */
  readonly marketplacePort?: MarketplacePort;
}

/**
 * The grid island. It derives the featured campaign only to exclude it from the
 * grid — the featured card itself is the hero island's job — then renders the
 * 「PyMEs en campaña」 section.
 */
export function PymesEnCampana({ marketplacePort }: PymesEnCampanaProps) {
  // Captured once: an omitted prop stays the browser port, and a test can still
  // inject a fake without it being re-created on every render.
  const [port] = useState(() => marketplacePort ?? createBrowserMarketplacePort());
  const marketplace = useMarketplace(port);

  const featured = selectFeatured(marketplace.items);
  const grid = selectGrid(marketplace.items, featured?.campaignId ?? null);

  return (
    <CampaignGrid
      cards={grid}
      isLoading={marketplace.isLoading}
      loadFailed={marketplace.loadFailed}
      onRetry={marketplace.reload}
    />
  );
}

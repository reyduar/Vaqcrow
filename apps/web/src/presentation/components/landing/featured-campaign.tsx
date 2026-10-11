"use client";

import { useState } from "react";
import { ProgressBar as HeroProgressBar } from "@heroui/react";
import Link from "next/link";
import type { IconType } from "react-icons";
import { IoAlertOutline, IoArrowForwardOutline, IoHelpCircleOutline, IoShieldOutline, IoWarningOutline } from "react-icons/io5";
import type { RiskBand } from "@vaqcrow/contracts";
import type { MarketplaceCard, MarketplacePort } from "@/application/ports/marketplace-port";
import { selectFeatured } from "@/application/marketplace/landing-selection";
import { toMarketplaceCardView } from "@/application/marketplace/view-model";
import { createBrowserMarketplacePort } from "@/infrastructure/marketplace/create-marketplace-port";
import { useMarketplace } from "@/state/use-marketplace";
import { Badge, type BadgeTone } from "../badge";
import { Skeleton } from "../skeleton";

/**
 * The landing's featured campaign (`Vaqcrow Landing.dc.html` lines 98–127,
 * Feature #418, WU2; owner decision Q1, 2026-10-10). It is one of the landing's
 * two client islands: it owns the public-list fetch with the same `/explore`
 * data path (`createBrowserMarketplacePort()` + `useMarketplace`, one SWR key
 * shared with the grid island, so the request is deduped), derives the featured
 * campaign with the pure `landing-selection` module, and renders the template's
 * `feat-t` card: an «Oportunidad destacada» badge over the image, the funding
 * block, a metrics row and the evidence CTA. It has no outer section of its own
 * — the hero grid places it as its second column.
 *
 * Two variants share that shell: when the public list yields a real campaign
 * the card is built from public-contract fields only (no «desde», no KYC — the
 * contract carries neither), so its metrics row has two columns and it keeps
 * the campaign's real photo. With no campaign the template's own simulated
 * example is shown instead, marked `SIMULADO`, with a representative image and
 * a three-column row including the (simulated) KYC result. Its CTA goes to the
 * marketplace, since there is no campaign to open.
 */

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/** Visible text is short; the campaign name goes in the accessible name, as in `CampaignCard`. */
const CTA_LABEL = "Ver evidencia y riesgo";

const CTA_CLASS = `flex h-11 items-center justify-center gap-2 rounded-control border border-control text-[15px] font-semibold text-text-primary no-underline hover:bg-page-surface ${FOCUS_RING}`;
const HIGHLIGHT_BADGE_CLASS =
  "absolute top-3.5 left-3.5 inline-flex h-[26px] items-center rounded-pill border border-border bg-canvas px-2.5 text-xs font-semibold";

/**
 * Risk treatments mirror `CampaignCard` (Feature #414, WU4b): the meaning is
 * always in the label, the tone is a secondary hint, and the icon keeps it from
 * being colour-only. `low` is info, `medium` caution and `high` critical — the
 * same mapping the marketplace uses.
 */
const RISK_TONE: Readonly<Record<RiskBand, BadgeTone>> = Object.freeze({ low: "info", medium: "caution", high: "critical" });
const RISK_ICON: Readonly<Record<RiskBand, IconType>> = Object.freeze({
  low: IoShieldOutline,
  medium: IoAlertOutline,
  high: IoWarningOutline
});

interface FundingProps {
  readonly raisedLabel: string;
  readonly goalLabel: string;
  readonly percent: number;
  readonly percentLabel: string;
  /** Already formatted, e.g. "Cierra el 30/11/2026"; empty hides the trailing line. */
  readonly closeLabel: string;
}

/**
 * The featured funding block. `CampaignCard`'s shared `ProgressBar` renders a
 * label/output pair that does not fit this card's large-number layout, so the
 * bar is composed directly from HeroUI's `ProgressBar` (the same primitive that
 * wrapper uses) with the track alone.
 */
function FeaturedFunding({ raisedLabel, goalLabel, percent, percentLabel, closeLabel }: FundingProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-text-secondary">Fondeado en la bóveda</div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">{raisedLabel}</span>
        <span className="text-sm text-text-secondary">de {goalLabel}</span>
      </div>
      <HeroProgressBar
        value={percent}
        minValue={0}
        maxValue={100}
        valueLabel={`${percent} %`}
        aria-label="Progreso de fondeo"
        className="mt-1"
      >
        <HeroProgressBar.Track className="h-1.5 rounded-pill bg-page-surface shadow-[inset_0_0_0_1px_var(--color-page-border)]">
          <HeroProgressBar.Fill className="rounded-pill" />
        </HeroProgressBar.Track>
      </HeroProgressBar>
      <div className="mt-1 flex justify-between text-[13px]">
        <span className="font-semibold">{percentLabel}</span>
        {closeLabel ? <span className="text-text-secondary">{closeLabel}</span> : null}
      </div>
    </div>
  );
}

function FeaturedCampaignReal({ card }: { readonly card: MarketplaceCard }) {
  const view = toMarketplaceCardView(card);
  const RiskIcon = view.riskBand ? RISK_ICON[view.riskBand] : IoHelpCircleOutline;
  const closeLabel = view.closeLabel ? `Cierra el ${view.closeLabel}` : "";

  return (
    <article aria-labelledby="feat-t" className="overflow-hidden rounded-card border border-border bg-raised">
      <div className="relative aspect-[16/8] w-full border-b border-border bg-page-surface">
        {view.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- an API-proxied bytes endpoint; next/image would need remote-pattern config.
          <img src={view.imageSrc} alt={view.imageAlt} className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <span className={HIGHLIGHT_BADGE_CLASS}>Oportunidad destacada</span>
      </div>

      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="feat-t" className="m-0 text-[22px] leading-[1.3] font-bold tracking-[-0.01em]">
              {view.name}
            </h2>
            <div className="mt-0.5 text-sm text-text-secondary">{view.meta}</div>
          </div>
          {/* The marketplace is synthetic by the demo's own disclosure, and
              `/explore` marks every card the same way. */}
          <Badge variant="simulado" label="SIMULADO" lang="es" />
        </div>

        <FeaturedFunding
          raisedLabel={view.raisedLabel}
          goalLabel={view.goalLabel}
          percent={view.fundedPercent}
          percentLabel={`${view.fundedPercent} %`}
          closeLabel={closeLabel}
        />

        <dl className="m-0 grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div>
            <dt className="text-xs text-text-secondary">Revenue share</dt>
            <dd className="m-0 mt-0.5 font-semibold">{view.revenueShareLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Riesgo</dt>
            <dd className="m-0 mt-0.5">
              <Badge variant="risk" label={view.riskLabel} tone={view.riskTone} icon={RiskIcon} lang="es" />
            </dd>
          </div>
        </dl>

        <Link href={view.href} className={CTA_CLASS}>
          {CTA_LABEL}
          <IoArrowForwardOutline aria-hidden="true" focusable="false" className="text-[16px]" />
        </Link>
      </div>
    </article>
  );
}

/**
 * The template's simulated example, verbatim (`Vaqcrow Landing.dc.html` lines
 * 100–124). It is frozen data: no campaign backs it, so every number is a
 * literal and the card is unambiguously marked `SIMULADO`.
 */
const SIMULATED = Object.freeze({
  name: "Panadería Horizonte SRL",
  meta: "Panificación · Córdoba · desde 2016",
  imageSrc: "/pyme-panaderia.jpg",
  imageAlt: "Estantes con panes en una panadería (imagen representativa)",
  raisedLabel: "ARS 9.450.000",
  goalLabel: "ARS 15.000.000",
  percent: 63,
  percentLabel: "63 %",
  closeLabel: "Cierra el 30/11/2026",
  revenueShareLabel: "4,5 % de ventas",
  riskLabel: "Medio",
  kycLabel: "Aprobado · SIMULADO"
});

function FeaturedCampaignSimulated() {
  return (
    <article aria-labelledby="feat-t" className="overflow-hidden rounded-card border border-border bg-raised">
      <div className="relative aspect-[16/8] w-full border-b border-border bg-page-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- a bundled demo asset; next/image adds no value here. */}
        <img src={SIMULATED.imageSrc} alt={SIMULATED.imageAlt} className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute right-3 bottom-3 rounded-pill bg-[rgba(17,17,17,0.72)] px-2 py-[3px] text-[11px] font-medium text-white">
          Imagen representativa
        </span>
        <span className={HIGHLIGHT_BADGE_CLASS}>Oportunidad destacada</span>
      </div>

      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="feat-t" className="m-0 text-[22px] leading-[1.3] font-bold tracking-[-0.01em]">
              {SIMULATED.name}
            </h2>
            <div className="mt-0.5 text-sm text-text-secondary">{SIMULATED.meta}</div>
          </div>
          <Badge variant="simulado" label="SIMULADO" lang="es" />
        </div>

        <FeaturedFunding
          raisedLabel={SIMULATED.raisedLabel}
          goalLabel={SIMULATED.goalLabel}
          percent={SIMULATED.percent}
          percentLabel={SIMULATED.percentLabel}
          closeLabel={SIMULATED.closeLabel}
        />

        <dl className="m-0 grid grid-cols-3 gap-3 border-t border-border pt-4">
          <div>
            <dt className="text-xs text-text-secondary">Revenue share</dt>
            <dd className="m-0 mt-0.5 font-semibold">{SIMULATED.revenueShareLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Riesgo</dt>
            <dd className="m-0 mt-0.5">
              <Badge variant="risk" label={SIMULATED.riskLabel} tone={RISK_TONE.medium} icon={RISK_ICON.medium} lang="es" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">KYC</dt>
            <dd className="m-0 mt-0.5 text-sm font-semibold">{SIMULATED.kycLabel}</dd>
          </div>
        </dl>

        <Link href="/explore" className={CTA_CLASS}>
          {CTA_LABEL}
          <IoArrowForwardOutline aria-hidden="true" focusable="false" className="text-[16px]" />
        </Link>
      </div>
    </article>
  );
}

export interface FeaturedCampaignProps {
  /** Injected by tests; production uses the browser port. */
  readonly marketplacePort?: MarketplacePort;
}

/**
 * The hero's featured slot, rendered as its second grid column. While the
 * public list is in flight it is a single loading region; once settled it is
 * the real campaign when there is one, and the simulated example otherwise (a
 * failed read has no campaign to show either, so it takes the same fallback
 * rather than leaving the slot empty).
 */
export function FeaturedCampaign({ marketplacePort }: FeaturedCampaignProps) {
  // Captured once: an omitted prop stays the browser port, and a test can still
  // inject a fake without it being re-created on every render.
  const [port] = useState(() => marketplacePort ?? createBrowserMarketplacePort());
  const marketplace = useMarketplace(port);
  const featured = selectFeatured(marketplace.items);

  return (
    <div className="w-full">
      {marketplace.isLoading ? (
        <Skeleton shapes={["card"]} label="Cargando campaña destacada" />
      ) : featured ? (
        <FeaturedCampaignReal card={featured} />
      ) : (
        <FeaturedCampaignSimulated />
      )}
    </div>
  );
}

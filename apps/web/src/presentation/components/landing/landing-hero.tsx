import type { ReactNode } from "react";
import { IoArrowForwardOutline, IoFlaskOutline, IoGitNetworkOutline, IoInformationCircleOutline } from "react-icons/io5";
import Link from "next/link";
import { Badge } from "../badge";
import { HeroAccountCta } from "./hero-account-cta";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export interface LandingHeroProps {
  /**
   * The featured campaign, passed in as a Client Component element so the hero
   * stays a Server Component. It renders as the grid's second column, beside the
   * hero text and vertically centered, exactly as in the template.
   */
  readonly featured?: ReactNode;
}

/**
 * The landing hero (`Vaqcrow Landing.dc.html` lines 82–136, WU1 + WU2): a
 * two-column grid whose first column holds the three demo badges, the headline
 * with the emphasized word, the promise paragraph, the primary «Explorar
 * PyMEs» CTA, the role-aware secondary CTA island and the «Leer los límites de
 * esta demo» anchor, and whose second column is the featured campaign card
 * (`featured`, a client island). The template's `repeat(auto-fit,
 * minmax(min(100%,460px),1fr))` collapses the two columns into a stack on
 * narrow viewports.
 */
export function LandingHero({ featured }: LandingHeroProps) {
  return (
    <section
      aria-labelledby="hero-t"
      className="mx-auto grid w-full max-w-[1264px] grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-center gap-16 px-8 py-20"
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap gap-2">
          <Badge variant="demo" label="DEMO" />
          <Badge variant="testnet" label="TESTNET" icon={IoGitNetworkOutline} />
          <Badge variant="simulado" label="DATOS SIMULADOS" icon={IoFlaskOutline} />
        </div>

        <h1
          id="hero-t"
          className="m-0 text-[clamp(40px,5.4vw,60px)] leading-[1.04] font-bold tracking-[-0.035em] text-balance"
        >
          Capital para PyMEs, <span className="text-brand-accent-text">respaldado</span> por sus ventas.
        </h1>

        <p className="m-0 max-w-[54ch] text-[18px] leading-[1.55] text-pretty text-text-secondary">
          Una PyME formal recibe financiamiento y lo devuelve con una participación en sus ingresos. Cada campaña vive
          en una bóveda de un contrato de Stellar: nadie tiene una clave para mover los aportes.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/explore"
            className={`flex h-12 items-center gap-2 rounded-control bg-brand-accent px-5 text-[15px] font-semibold text-on-accent no-underline hover:bg-brand-accent-hover ${FOCUS_RING}`}
          >
            Explorar PyMEs
            <IoArrowForwardOutline aria-hidden="true" focusable="false" className="text-[17px]" />
          </Link>
          <HeroAccountCta />
        </div>

        <Link
          href="#limites"
          className={`inline-flex items-center gap-1.5 self-start text-sm font-semibold ${FOCUS_RING}`}
        >
          <IoInformationCircleOutline aria-hidden="true" focusable="false" className="text-[17px]" />
          Leer los límites de esta demo
        </Link>
      </div>

      {featured}
    </section>
  );
}

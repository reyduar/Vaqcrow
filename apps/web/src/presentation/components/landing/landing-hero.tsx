import { IoArrowForwardOutline, IoFlaskOutline, IoGitNetworkOutline, IoInformationCircleOutline } from "react-icons/io5";
import Link from "next/link";
import { Badge } from "../badge";
import { HeroAccountCta } from "./hero-account-cta";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/**
 * The landing hero (`Vaqcrow Landing.dc.html` lines 82–96, WU1): the three
 * demo badges, the headline with the emphasized word, the promise paragraph,
 * the primary «Explorar PyMEs» CTA, the role-aware secondary CTA island and
 * the «Leer los límites de esta demo» anchor. The featured-campaign card that
 * shares this row in the template arrives with WU2.
 */
export function LandingHero() {
  return (
    <section aria-labelledby="hero-t" className="mx-auto flex w-full max-w-[1264px] flex-col gap-7 px-8 py-20">
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
        Una PyME formal recibe financiamiento y lo devuelve con una participación en sus ingresos. Cada campaña vive en
        una bóveda de un contrato de Stellar: nadie tiene una clave para mover los aportes.
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
    </section>
  );
}

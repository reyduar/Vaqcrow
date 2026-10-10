import Link from "next/link";
import { microcopy } from "@/application/trust/disclosures";
import { BrandIsotipo } from "../brand-isotipo";
import { CanonicalDisclosure } from "../canonical-disclosure";

/**
 * LandingFooter (Feature #418, WU3): the rich footer of
 * `Vaqcrow Landing.dc.html` (lines 252-267), mounted only by `/`. The other
 * pages keep the compact `SiteFooter`, which deliberately omits nav links.
 *
 * Decoding of the template (recorded, not left implicit):
 * - **Brand block.** The isotipo + "Vaqcrow" wordmark + the revenue-share
 *   tagline, verbatim from the template (lines 254-256).
 * - **Three link columns.** The template's `Plataforma` / `Aprender` /
 *   `Proyecto` `<nav>`s (lines 258-260), each an `aria-label`led landmark. The
 *   English route slugs are the ones `application/navigation/shell-nav.ts`
 *   already defines (`/explore`, `/#como-funciona`, `/entrepreneur-guide`,
 *   `/investor-guide`, `/about`); none is invented. `/help` (owned by #394) and
 *   the `#limites` anchor are shown on purpose — a 404 is accepted (owner
 *   decision, 2026-10-10). `Contacto` stays `#`, exactly as the template leaves
 *   it: its destination is an open #394 question, so no route is invented.
 * - **Disclosure.** Rendered only through `CanonicalDisclosure` (`no-production`),
 *   the single sanctioned render path — the copy is never retyped here.
 * - **Legal row.** "Vaqcrow · Trabajo Fin de Máster · 2026" and the canonical
 *   `microcopy.testnetBadge`. The template's own legal slot reads "Stellar
 *   Testnet · Activos sin valor económico"; treating that as copy would invent
 *   wording, so the canonical badge is used instead (as `SiteFooter` documents).
 * - **Tokens.** `--border` → `border-border`, `--surface` → `bg-surface`,
 *   `--text2` → `text-text-secondary`. The template's `56/32/32` padding, the
 *   `minmax(min(100%,200px),1fr)` auto-fit grid, the brand's `span 2` and the
 *   full-width disclosure/legal rows are reproduced.
 */
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
const NAV_LINK = `text-text-secondary no-underline hover:text-text-primary ${FOCUS_RING}`;

interface FooterLink {
  readonly label: string;
  readonly href: string;
}

interface FooterColumn {
  readonly title: string;
  readonly links: readonly FooterLink[];
}

const COLUMNS: readonly FooterColumn[] = [
  {
    title: "Plataforma",
    links: [
      { label: "Explorar PyMEs", href: "/explore" },
      { label: "Cómo funciona", href: "/#como-funciona" },
      { label: "Para emprendedores", href: "/entrepreneur-guide" }
    ]
  },
  {
    title: "Aprender",
    links: [
      { label: "Guía de inversión", href: "/investor-guide" },
      { label: "Centro de ayuda", href: "/help" },
      { label: "Límites de la demo", href: "#limites" }
    ]
  },
  {
    title: "Proyecto",
    links: [
      { label: "Acerca de Vaqcrow", href: "/about" },
      { label: "Contacto", href: "#" }
    ]
  }
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-[1264px] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-10 px-8 pt-14 pb-8">
        <div className="col-span-2 flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-2">
            <BrandIsotipo />
            <span className="text-[19px] font-bold tracking-[-0.02em]">Vaqcrow</span>
          </div>
          <p className="m-0 max-w-[40ch] text-sm text-text-secondary">
            Financiamiento de PyMEs por revenue share, con bóvedas en contratos de Stellar.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2.5 text-sm">
            <span className="font-semibold">{column.title}</span>
            {column.links.map((link) => (
              <Link key={link.label} href={link.href} className={NAV_LINK}>
                {link.label}
              </Link>
            ))}
          </nav>
        ))}

        <div className="col-span-full">
          <CanonicalDisclosure id="no-production" />
        </div>

        <div className="col-span-full flex flex-wrap justify-between gap-4 text-xs text-text-secondary">
          <span>Vaqcrow · Trabajo Fin de Máster · 2026</span>
          <span>{microcopy.testnetBadge}</span>
        </div>
      </div>
    </footer>
  );
}

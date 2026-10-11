import Link from "next/link";
import { ABOUT_COPY } from "@/application/about/copy";
import { Badge } from "../badge";
import { ABOUT_ICONS } from "./about-icons";
import { DecorativeCoin } from "./decorative-coin";

const { hero, stack } = ABOUT_COPY;

const PRIMARY_CTA =
  "inline-flex h-12 items-center gap-2 rounded-control bg-brand-accent px-5 text-[15px] font-semibold text-on-accent no-underline transition-colors hover:bg-brand-accent-hover";
const SECONDARY_CTA =
  "inline-flex h-12 items-center gap-2 rounded-control border border-control px-5 text-[15px] font-semibold text-text-primary no-underline transition-colors hover:bg-page-surface";

/**
 * `/about` hero (`Vaqcrow Acerca de.dc.html` `:58-89`): the eyebrow pill, the
 * split `<h1>`, the subtitle with its `revenue share` emphasis, the two CTAs
 * and the "Cómo está construida la demo" stack card. The copy comes entirely
 * from `ABOUT_COPY`; only the two decorative coins are positional markup.
 */
export function AboutHero() {
  const ArrowIcon = ABOUT_ICONS["arrow-forward-outline"];
  const PersonIcon = ABOUT_ICONS["person-outline"];

  return (
    <section
      aria-labelledby={hero.headingId}
      className="relative grid gap-14 pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-16"
    >
      <DecorativeCoin size={210} rotate={-16} className="top-[-48px] right-[-40px]" />
      <DecorativeCoin size={64} rotate={22} className="top-[-40px] left-[14%]" />

      <div className="relative z-10 flex flex-col gap-6">
        <span className="inline-flex w-fit items-center rounded-pill bg-brand-accent-tint px-2.5 py-1 text-xs font-semibold text-brand-accent-text">
          {hero.eyebrow}
        </span>
        <h1
          id={hero.headingId}
          className="m-0 text-[clamp(40px,5.2vw,56px)] leading-[1.05] font-bold tracking-[-0.035em]"
        >
          {hero.titleLead}
          <span className="text-brand-accent-text">{hero.titleAccent}</span>
        </h1>
        <p className="m-0 max-w-[52ch] text-[18px] leading-[1.55] text-pretty text-text-secondary">
          {hero.subtitleLead}
          <strong className="font-[650] text-text-primary">{hero.subtitleStrong}</strong>
          {hero.subtitleTail}
        </p>
        <div className="flex flex-wrap gap-3">
          {hero.ctas.map((cta, index) =>
            index === 0 ? (
              <Link key={cta.href} href={cta.href} className={PRIMARY_CTA}>
                {cta.label}
                <ArrowIcon aria-hidden="true" focusable="false" className="text-[17px]" />
              </Link>
            ) : (
              <a key={cta.href} href={cta.href} className={SECONDARY_CTA}>
                <PersonIcon aria-hidden="true" focusable="false" className="text-[17px]" />
                {cta.label}
              </a>
            )
          )}
        </div>
      </div>

      <div className="relative z-10">
        <div
          data-about-stack=""
          className="relative z-10 flex flex-col gap-4 rounded-panel border border-border bg-raised p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-[650]">{stack.title}</div>
              <div className="text-[13px] text-text-secondary">{stack.subtitle}</div>
            </div>
            <Badge variant="testnet" label={stack.badge} />
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {stack.rows.map((row) => {
              const RowIcon = ABOUT_ICONS[row.icon];
              return (
                <li
                  key={row.label}
                  className="flex items-center gap-3 rounded-control bg-page-surface px-3.5 py-3"
                >
                  <RowIcon aria-hidden="true" focusable="false" className="text-[20px] text-text-primary" />
                  <span className="flex-1 text-sm font-semibold">{row.label}</span>
                  <span className="font-mono text-xs text-text-secondary">{row.tag}</span>
                </li>
              );
            })}
          </ul>
          <p className="m-0 text-xs text-text-secondary">{stack.footnote}</p>
        </div>
        <DecorativeCoin size={104} rotate={12} className="bottom-[-78px] left-[-58px]" />
      </div>
    </section>
  );
}

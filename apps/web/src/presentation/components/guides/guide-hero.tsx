import Link from "next/link";
import type { Guide } from "@/application/guides/types";
import { GUIDE_ICONS, type GuideIconName } from "./guide-icons";

const PRIMARY_CTA =
  "inline-flex h-12 items-center gap-2 rounded-control bg-brand-accent px-5 text-[15px] font-semibold text-on-accent no-underline transition-colors hover:bg-brand-accent-hover";
const SECONDARY_CTA =
  "inline-flex h-12 items-center gap-2 rounded-control border border-control px-5 text-[15px] font-semibold text-text-primary no-underline transition-colors hover:bg-page-surface";

/**
 * The guide hero (`Vaqcrow Guia emprendedores.dc.html` `:105-112`,
 * `Vaqcrow Guia de inversion.dc.html` `:105-111`): the eyebrow pill (with the
 * template's decorative glyph, `:107`), the split `<h1>`, the subtitle, the
 * optional CTAs and the dashed advisory note. Every string comes from the
 * `Guide`; the investor guide carries no CTAs and its row is simply absent. A
 * CTA with a `#` target is a same-page anchor; anything else is an app route
 * and goes through `next/link`.
 */
export function GuideHero({ guide }: { readonly guide: Guide }) {
  const EyebrowIcon = GUIDE_ICONS[guide.eyebrowIcon as GuideIconName];
  const NoteIcon = GUIDE_ICONS["information-circle-outline"];
  const ArrowIcon = GUIDE_ICONS["arrow-forward-outline"];

  return (
    <section className="grid items-end gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-x-16">
      <div className="flex flex-col gap-3.5">
        <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-brand-accent-tint px-2.5 py-1 text-xs font-semibold text-brand-accent-text">
          <EyebrowIcon aria-hidden="true" focusable="false" className="text-[14px]" />
          {guide.eyebrow}
        </span>
        <h1 className="m-0 text-[clamp(40px,5vw,56px)] leading-[1.05] font-bold tracking-[-0.035em] text-balance">
          {guide.titleLead}
          <span className="text-brand-accent-text">{guide.titleAccent}</span>
        </h1>
        <p className="m-0 max-w-[68ch] text-[17px] leading-[1.6] text-pretty text-text-secondary">{guide.subtitle}</p>
        {guide.ctas.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-3">
            {guide.ctas.map((cta, index) => {
              const classes = index === 0 ? PRIMARY_CTA : SECONDARY_CTA;
              if (cta.href.startsWith("#")) {
                return (
                  <a key={cta.href} href={cta.href} className={classes}>
                    {cta.label}
                  </a>
                );
              }
              return (
                <Link key={cta.href} href={cta.href} className={classes}>
                  {cta.label}
                  {index === 0 ? <ArrowIcon aria-hidden="true" focusable="false" className="text-[17px]" /> : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex gap-3 rounded-card border border-dashed border-control p-4">
        <NoteIcon aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-[20px]" />
        <p className="m-0 text-sm leading-[1.55] text-pretty">{guide.note}</p>
      </div>
    </section>
  );
}

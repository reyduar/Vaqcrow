import { ABOUT_COPY } from "@/application/about/copy";
import { ABOUT_CONTACT_ICONS } from "./about-icons";
import { DecorativeCoin } from "./decorative-coin";

const { contact } = ABOUT_COPY;

const PRIMARY_CTA =
  "inline-flex h-12 items-center gap-2 rounded-control bg-brand-accent px-5 text-[15px] font-semibold text-on-accent no-underline transition-colors hover:bg-brand-accent-hover";
const SECONDARY_CTA =
  "inline-flex h-12 items-center gap-2 rounded-control border border-control px-5 text-[15px] font-semibold text-text-primary no-underline transition-colors hover:bg-page-surface";

/**
 * «Hablemos» (`Vaqcrow Acerca de.dc.html` `:156-170`): the centred contact
 * panel with its three decorative coins and the four CTAs. The hrefs are the
 * real owner-chosen destinations already in `ABOUT_COPY` (LinkedIn, Discord,
 * email, GitHub), replacing the template's `#` placeholders.
 */
export function AboutContact() {
  return (
    <section id={contact.sectionId} aria-labelledby={contact.headingId}>
      <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-panel border border-border px-8 py-20 text-center">
        <DecorativeCoin size={150} rotate={-20} className="top-[-48px] left-[-40px]" />
        <DecorativeCoin size={92} rotate={18} className="bottom-[-44px] right-[4%]" />
        <DecorativeCoin size={48} rotate={-8} className="top-3 right-[-16px]" />

        <h2
          id={contact.headingId}
          className="relative z-10 m-0 text-[clamp(30px,3.4vw,40px)] leading-[1.15] font-bold tracking-[-0.025em]"
        >
          {contact.title}
        </h2>
        <p className="relative z-10 m-0 max-w-[52ch] text-[17px] leading-[1.55] text-pretty text-text-secondary">
          {contact.body}
        </p>
        <div className="relative z-10 mt-3 flex flex-wrap justify-center gap-3">
          {contact.ctas.map((cta, index) => {
            const Icon = ABOUT_CONTACT_ICONS[cta.label];
            return (
              <a
                key={cta.href}
                href={cta.href}
                className={index === 0 ? PRIMARY_CTA : SECONDARY_CTA}
                {...(cta.href.startsWith("http") ? { rel: "noreferrer", target: "_blank" } : {})}
              >
                <Icon aria-hidden="true" focusable="false" className="text-[18px]" />
                {cta.label}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

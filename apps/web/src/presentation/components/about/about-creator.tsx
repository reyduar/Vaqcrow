import { ABOUT_COPY } from "@/application/about/copy";
import { ABOUT_ICONS } from "./about-icons";

const { creator } = ABOUT_COPY;

/**
 * Owner decision (2026-10-10): the template left the creator CTA's href as a
 * placeholder `#`; the real destination is the owner's LinkedIn profile, the
 * same URL the «Hablemos» LinkedIn CTA already carries.
 */
export const CREATOR_PROFILE_HREF = "https://www.linkedin.com/in/arielduarte";

const PRIMARY_CTA =
  "inline-flex h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-brand-accent-text no-underline hover:text-text-primary";

/**
 * «Sobre el creador» (`Vaqcrow Acerca de.dc.html` `:128-154`): the 4:5 photo
 * with its floating experience badge, and the eyebrow, name, role, bio, the
 * three stats and the profile CTA. The photo is the template's own
 * `creador-gris.png`, copied into `public/` like the other template assets.
 */
export function AboutCreator() {
  const ArrowIcon = ABOUT_ICONS["arrow-forward-outline"];
  const { experienceBadge } = creator;

  return (
    <section
      id={creator.sectionId}
      aria-labelledby={creator.headingId}
      className="-mx-8 border-y border-border bg-surface px-8 py-24"
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div className="relative w-full max-w-[400px]">
          <div className="aspect-[4/5] w-full overflow-hidden rounded-panel border border-border bg-canvas">
            {/* Static template asset in `public/`: no remote-pattern config needed,
                but kept as a plain <img> like the other template photos. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- a static public template asset. */}
            <img src="/creador-gris.png" alt={creator.photoAlt} className="h-full w-full object-cover" />
          </div>
          <div className="absolute right-[-16px] bottom-6 rounded-card border border-border bg-raised px-[18px] py-3.5">
            <div className="text-[28px] leading-[1.1] font-bold tracking-[-0.02em] text-brand-accent-text">
              {experienceBadge.value}
            </div>
            <div className="text-xs font-medium text-text-secondary">{experienceBadge.label}</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <span className="text-[13px] font-semibold text-brand-accent-text">{creator.eyebrow}</span>
          <div>
            <h2
              id={creator.headingId}
              className="m-0 text-[clamp(30px,3.4vw,40px)] leading-[1.15] font-bold tracking-[-0.025em]"
            >
              {creator.name}
            </h2>
            <div className="mt-1 text-base font-semibold">{creator.role}</div>
          </div>
          <p className="m-0 max-w-[62ch] text-base leading-[1.6] text-pretty text-text-secondary">
            {creator.bio}
          </p>
          <dl className="m-0 grid gap-3 sm:grid-cols-3">
            {creator.stats.map((stat) => (
              <div key={stat.label} className="rounded-control border border-border bg-canvas p-4">
                <dt className="text-xs text-text-secondary">{stat.label}</dt>
                <dd className="mt-1 text-[18px] font-bold">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <a href={CREATOR_PROFILE_HREF} className={PRIMARY_CTA}>
            {creator.profileCta}
            <ArrowIcon aria-hidden="true" focusable="false" className="text-[16px]" />
          </a>
        </div>
      </div>
    </section>
  );
}

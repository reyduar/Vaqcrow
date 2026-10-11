import { ABOUT_COPY } from "@/application/about/copy";
import { CanonicalDisclosure } from "../canonical-disclosure";
import { ABOUT_ICONS } from "./about-icons";

const { pillars } = ABOUT_COPY;

/**
 * «Pilares · ¿Qué es Vaqcrow?» (`Vaqcrow Acerca de.dc.html` `:104-126`): the
 * eyebrow + `<h2>` + intro, the academic callout, and the six-pillar grid.
 *
 * The callout's canonical sentence is NEVER retyped here: `ABOUT_COPY` exposes
 * only the `no-production` disclosure id, and it renders exclusively through
 * `<CanonicalDisclosure>`. That component owns its own dashed presentation, so
 * the academic lead (icon + title) sits directly above it rather than in a
 * second dashed box — nesting borders is what the footer already avoids.
 */
export function AboutPillars() {
  const SchoolIcon = ABOUT_ICONS["school-outline"];

  return (
    <section aria-labelledby={pillars.headingId} className="flex flex-col gap-10">
      <div className="flex max-w-[720px] flex-col gap-3">
        <span className="text-[13px] font-semibold text-brand-accent-text">{pillars.eyebrow}</span>
        <h2
          id={pillars.headingId}
          className="m-0 text-[clamp(30px,3.4vw,40px)] leading-[1.15] font-bold tracking-[-0.025em]"
        >
          {pillars.title}
        </h2>
        <p className="m-0 text-[18px] leading-[1.55] text-text-secondary">{pillars.intro}</p>
      </div>

      <div className="flex gap-4">
        <SchoolIcon aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-[22px] text-text-primary" />
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[15px] font-[650]">{pillars.academicCallout.title}</p>
          <CanonicalDisclosure id={pillars.academicCallout.disclosure} />
        </div>
      </div>

      <ul className="m-0 grid list-none gap-px overflow-hidden rounded-card border border-border bg-border p-0 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.items.map((pillar) => {
          const PillarIcon = ABOUT_ICONS[pillar.icon];
          return (
            <li key={pillar.title} className="flex flex-col gap-3 bg-canvas p-7">
              <PillarIcon aria-hidden="true" focusable="false" className="text-[24px] text-brand-accent-text" />
              <h3 className="m-0 text-[18px] leading-[1.3] font-bold">{pillar.title}</h3>
              <p className="m-0 text-sm leading-[1.55] text-pretty text-text-secondary">{pillar.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

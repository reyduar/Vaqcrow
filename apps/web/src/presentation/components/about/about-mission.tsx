import { ABOUT_COPY } from "@/application/about/copy";

const { mission } = ABOUT_COPY;

/**
 * «Misión y visión» (`Vaqcrow Acerca de.dc.html` `:91-102`): the template's
 * muted band — a two-column layout with the eyebrow + `<h2>` on the left and
 * the blockquote + body on the right. The band spans the shell's container
 * with `-mx-8`, since this branch's `AppShell` has no full-bleed prop (#418
 * adds one; reconciling is a later step).
 */
export function AboutMission() {
  return (
    <section
      aria-labelledby={mission.headingId}
      className="-mx-8 border-y border-border bg-surface px-8 py-24"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col gap-3">
          <span className="text-[13px] font-semibold text-brand-accent-text">{mission.eyebrow}</span>
          <h2
            id={mission.headingId}
            className="m-0 text-[clamp(30px,3.4vw,40px)] leading-[1.15] font-bold tracking-[-0.025em]"
          >
            {mission.title}
          </h2>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <blockquote className="m-0 max-w-[42ch] text-pretty text-[clamp(22px,2.4vw,28px)] leading-[1.35] font-medium tracking-[-0.01em]">
            {mission.quote}
          </blockquote>
          <p className="m-0 max-w-[68ch] text-base leading-[1.6] text-text-secondary">{mission.body}</p>
        </div>
      </div>
    </section>
  );
}

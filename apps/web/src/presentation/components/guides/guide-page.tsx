import type { Guide } from "@/application/guides/types";
import { GuideFinalCta } from "./guide-final-cta";
import { GuideHero } from "./guide-hero";
import { GuideSection } from "./guide-section";
import { GuideToc } from "./guide-toc";

/**
 * Shared renderer for the two public guides (Feature #394 / WU3). Both
 * `/entrepreneur-guide` and `/investor-guide` are the same page parameterized
 * by their `Guide` data: hero, the sticky TOC island beside the seven
 * numbered sections, and the closing CTA. The route wraps it in the public
 * `AppShell`; nothing here reads auth, the session, or the router.
 */
export function GuidePage({ guide }: { readonly guide: Guide }) {
  return (
    <div className="flex flex-col gap-10 pt-4 pb-16">
      <GuideHero guide={guide} />
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <GuideToc entries={guide.toc} />
        <div data-guide-body="" className="flex min-w-0 flex-col gap-12">
          {guide.sections.map((section) => (
            <GuideSection key={section.id} section={section} />
          ))}
          <GuideFinalCta finalCta={guide.finalCta} />
        </div>
      </div>
    </div>
  );
}

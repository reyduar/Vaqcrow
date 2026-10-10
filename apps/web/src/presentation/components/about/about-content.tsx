import { AboutContact } from "./about-contact";
import { AboutCreator } from "./about-creator";
import { AboutHero } from "./about-hero";
import { AboutMission } from "./about-mission";
import { AboutPillars } from "./about-pillars";

/**
 * The `/about` page body, in template order (`Vaqcrow Acerca de.dc.html`):
 * hero, «Misión y visión», «Pilares», «Sobre el creador» and «Hablemos».
 * Presentational only — the route wraps it in the public `AppShell`.
 */
export function AboutContent() {
  return (
    <div className="flex flex-col gap-24 pb-16">
      <AboutHero />
      <AboutMission />
      <AboutPillars />
      <AboutCreator />
      <AboutContact />
    </div>
  );
}

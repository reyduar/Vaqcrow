import { AppShell } from "@/presentation/components/app-shell";
import { HowItWorks } from "@/presentation/components/landing/how-it-works";
import { LandingHero } from "@/presentation/components/landing/landing-hero";
import { RealVsSimulated } from "@/presentation/components/landing/real-vs-simulated";
import { TrustStrip } from "@/presentation/components/landing/trust-strip";

/**
 * `/` — the public landing (Feature #418, WU1): hero → trust strip →
 * 「Cómo funciona」 → 「Qué es real y qué es simulado」, in template order and
 * inside the full-bleed shell (each band keeps its own 1264 px container).
 * The featured campaign, the marketplace grid, the rich footer and the
 * floating assistant arrive with WU2–WU4.
 */
export default function Home() {
  return (
    <AppShell fullBleed>
      <LandingHero />
      <TrustStrip />
      <HowItWorks />
      <RealVsSimulated />
    </AppShell>
  );
}

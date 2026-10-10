import { AppShell } from "@/presentation/components/app-shell";
import { FeaturedCampaign } from "@/presentation/components/landing/featured-campaign";
import { HowItWorks } from "@/presentation/components/landing/how-it-works";
import { LandingHero } from "@/presentation/components/landing/landing-hero";
import { PymesEnCampana } from "@/presentation/components/landing/pymes-en-campana";
import { RealVsSimulated } from "@/presentation/components/landing/real-vs-simulated";
import { TrustStrip } from "@/presentation/components/landing/trust-strip";

/**
 * `/` — the public landing (Feature #418): hero (text | featured) → trust strip
 * → 「PyMEs en campaña」 → 「Cómo funciona」 → 「Qué es real y qué es simulado」,
 * in template order and inside the full-bleed shell (each band keeps its own
 * 1264 px container).
 *
 * The featured card is a Client Component element passed into the server
 * `LandingHero`, so it renders as the hero grid's second column; the grid is its
 * own client island. Both derive from the public `GET /marketplace/campaigns`
 * list and share one SWR key, so the request is deduped. The rich footer and the
 * floating assistant arrive with WU3–WU4.
 */
export default function Home() {
  return (
    <AppShell fullBleed>
      <LandingHero featured={<FeaturedCampaign />} />
      <TrustStrip />
      <PymesEnCampana />
      <HowItWorks />
      <RealVsSimulated />
    </AppShell>
  );
}

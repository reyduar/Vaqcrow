import { AppShell } from "@/presentation/components/app-shell";
import { ExploreMarketplaceContainer } from "@/presentation/components/marketplace/explore-marketplace";

/**
 * `/explore` — the public marketplace (Feature #414). By owner decision the
 * grid is public without onboarding, so unlike `/portfolio` and `/company`
 * this route is not behind `RouteGate`; the session only decides whether the
 * favorite heart is shown.
 */
export default function ExplorePage() {
  return (
    <AppShell>
      <ExploreMarketplaceContainer />
    </AppShell>
  );
}

import { AppShell } from "@/presentation/components/app-shell";
import { ExploreMarketplaceContainer } from "@/presentation/components/marketplace/explore-marketplace";

/**
 * `/explore` — the public marketplace (Feature #414). By owner decision the
 * grid is public without onboarding, so unlike `/portfolio` and `/company`
 * this route is not behind `RouteGate`. The session never gates the grid: it
 * only decides whether the "Mis favoritos" toggle is shown and whether a heart
 * click toggles the server favorite (signed in) or asks for sign-in and returns
 * here (anonymous). The heart itself is always visible.
 */
export default function ExplorePage() {
  return (
    <AppShell>
      <ExploreMarketplaceContainer />
    </AppShell>
  );
}

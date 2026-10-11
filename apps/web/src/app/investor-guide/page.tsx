import { INVESTOR_GUIDE } from "@/application/guides/investor-guide";
import { AppShell } from "@/presentation/components/app-shell";
import { GuidePage } from "@/presentation/components/guides/guide-page";

/**
 * `/investor-guide` — the public "Guía de inversión" (Feature #394 / WU3).
 * Like `/about` and `/explore` it lives OUTSIDE the `(app)` group: no
 * `RouteGate`, no auth, no session, so the template's login gate (`:91-102`) is
 * intentionally not implemented. The header and footer come from `AppShell`.
 */
export default function InvestorGuidePage() {
  return (
    <AppShell>
      <GuidePage guide={INVESTOR_GUIDE} />
    </AppShell>
  );
}

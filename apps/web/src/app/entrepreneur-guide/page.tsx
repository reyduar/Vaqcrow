import { ENTREPRENEUR_GUIDE } from "@/application/guides/entrepreneur-guide";
import { AppShell } from "@/presentation/components/app-shell";
import { GuidePage } from "@/presentation/components/guides/guide-page";

/**
 * `/entrepreneur-guide` — the public "Guía para emprendedores" (Feature #394 /
 * WU3). Like `/about` and `/explore` it lives OUTSIDE the `(app)` group: no
 * `RouteGate`, no auth, no session, so the template's login gate (`:91-102`) is
 * intentionally not implemented. The header and footer come from `AppShell`.
 */
export default function EntrepreneurGuidePage() {
  return (
    <AppShell>
      <GuidePage guide={ENTREPRENEUR_GUIDE} />
    </AppShell>
  );
}

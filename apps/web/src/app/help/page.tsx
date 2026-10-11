import { AppShell } from "@/presentation/components/app-shell";
import { HelpContent } from "@/presentation/components/help/help-content";

/**
 * `/help` — the public "Centro de ayuda" page (Feature #394 / WU4). Like
 * `/explore`, `/about` and the guides it lives OUTSIDE the `(app)` group: no
 * `RouteGate`, no auth, no session, so the template's login gate (`:91-102`) is
 * intentionally not implemented. The header and footer come from `AppShell`.
 */
export default function HelpPage() {
  return (
    <AppShell>
      <HelpContent />
    </AppShell>
  );
}

import { AboutContent } from "@/presentation/components/about/about-content";
import { AppShell } from "@/presentation/components/app-shell";

/**
 * `/about` — the public "Acerca de" page (Feature #394 / WU2). Like `/explore`
 * it lives OUTSIDE the `(app)` group: no `RouteGate`, no auth, no session, so
 * the template's login gate is intentionally not implemented. The header and
 * footer come from the shared `AppShell`.
 */
export default function AboutPage() {
  return (
    <AppShell>
      <AboutContent />
    </AppShell>
  );
}

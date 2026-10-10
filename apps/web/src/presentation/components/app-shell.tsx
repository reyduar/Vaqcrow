import type { ReactNode } from "react";
import { microcopy } from "@/application/trust/disclosures";
import { AppHeader } from "./app-header";
import { SiteFooter } from "./site-footer";

const FOOTER_COPYRIGHT = "Vaqcrow · 2026";

/**
 * Page frame of the role-based app (`/`, `/portfolio`, `/company`): the
 * role-aware header, the template's 1264 px container and the canonical
 * footer with the "No apto para producción" disclosure.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-text-primary">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1264px] flex-1 flex-col gap-10 px-8 py-10">{children}</main>
      <SiteFooter copyright={FOOTER_COPYRIGHT} environment={microcopy.testnetBadge} />
    </div>
  );
}

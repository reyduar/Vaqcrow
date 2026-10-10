import type { ReactNode } from "react";
import { microcopy } from "@/application/trust/disclosures";
import { AppHeader } from "./app-header";
import { SiteFooter } from "./site-footer";

const FOOTER_COPYRIGHT = "Vaqcrow · 2026";

/**
 * Page frame of the role-based app (`/`, `/portfolio`, `/company`): the
 * role-aware header, the template's 1264 px container and the canonical
 * footer with the "No apto para producción" disclosure.
 *
 * `fullBleed` removes the 1264 px container from `<main>` so a page can render
 * full-width bands (the landing's colored sections) while each band keeps its
 * own inner container. The default (container) variant is unchanged, so
 * `/portfolio`, `/company` and `/explore` render exactly as before.
 *
 * `footer` lets a page supply its own footer — the landing passes the rich
 * `LandingFooter`. When it is omitted the compact `SiteFooter` renders exactly
 * as before, so every other page is unchanged.
 */
export function AppShell({
  children,
  fullBleed = false,
  footer
}: {
  children: ReactNode;
  fullBleed?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-text-primary">
      <AppHeader />
      {fullBleed ? (
        <main className="flex w-full flex-1 flex-col">{children}</main>
      ) : (
        <main className="mx-auto flex w-full max-w-[1264px] flex-1 flex-col gap-10 px-8 py-10">{children}</main>
      )}
      {footer ?? <SiteFooter copyright={FOOTER_COPYRIGHT} environment={microcopy.testnetBadge} />}
    </div>
  );
}

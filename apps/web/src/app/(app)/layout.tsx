import type { ReactNode } from "react";
import { AppShell } from "@/presentation/components/app-shell";
import { HelpAssistant } from "@/presentation/components/landing/help-assistant";
import { RouteGate } from "@/presentation/components/route-gate";

/**
 * `/portfolio` and `/reports` (INVERSOR) and `/company` (PYME): the role-aware
 * shell with the page content behind the client `RouteGate`. The server proxy
 * has already redirected anonymous and wrong-role visits before this renders.
 *
 * The floating help assistant is mounted once here, so every signed-in page
 * offers it (#570, after #535 mounted it on `/company` only). It is the same
 * client island the landing mounts and reuses its chat.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <RouteGate>{children}</RouteGate>
      <HelpAssistant />
    </AppShell>
  );
}

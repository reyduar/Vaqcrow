import type { ReactNode } from "react";
import { AppShell } from "@/presentation/components/app-shell";
import { RouteGate } from "@/presentation/components/route-gate";

/**
 * `/portfolio` (INVERSOR) and `/company` (PYME): the role-aware shell with the
 * page content behind the client `RouteGate`. The server proxy has already
 * redirected anonymous and wrong-role visits before this renders.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <RouteGate>{children}</RouteGate>
    </AppShell>
  );
}

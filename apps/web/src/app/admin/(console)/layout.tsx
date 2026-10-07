import type { ReactNode } from "react";
import { AdminConsoleGate } from "@/presentation/components/admin/admin-console-gate";
import { AdminShell } from "@/presentation/components/admin/admin-shell";

/**
 * The console shell and guard for `/admin/pymes` (and future console routes):
 * signed-out and non-admin visits are sent to `/admin` without the console
 * ever rendering (D2), and only a verified `ADMIN` sees the shell.
 */
export default function AdminConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <AdminConsoleGate>
      <AdminShell>{children}</AdminShell>
    </AdminConsoleGate>
  );
}

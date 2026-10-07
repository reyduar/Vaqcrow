"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { ADMIN_LOGIN_PATH, adminConsoleDecision } from "@/application/admin/admin-guard";
import { useSession } from "@/state/session-store-provider";

/**
 * Client half of the admin console guard (Feature #386 / D2).
 *
 * Signed-out visitors and signed-in non-admins both land on `/admin` without
 * the console ever rendering, so the denial reveals nothing. Nothing protected
 * renders until the session is resolved, so there is no flash of console
 * chrome. It never repeats the same `router.replace`, so no render can start a
 * redirect loop.
 */
export function AdminConsoleGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useSession((state) => state.status);
  const principal = useSession((state) => state.principal);
  const decision = adminConsoleDecision(status, principal?.role ?? null);
  const lastReplaced = useRef<string | null>(null);

  useEffect(() => {
    if (decision !== "deny") {
      lastReplaced.current = null;
      return;
    }
    if (lastReplaced.current === ADMIN_LOGIN_PATH) return;
    lastReplaced.current = ADMIN_LOGIN_PATH;
    router.replace(ADMIN_LOGIN_PATH);
  }, [decision, router]);

  if (decision !== "allow") return null;
  return <>{children}</>;
}

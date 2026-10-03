"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { gateRoute } from "@/application/auth/route-gate";
import { useSession } from "@/state/session-store-provider";

/**
 * Client half of the route gating. The server proxy (`src/proxy.ts`) already
 * redirects before a protected page renders; this gate covers what happens
 * after load — signing out in another tab, a stale page restored from the
 * router cache — with the same `gateRoute` rules. Nothing protected renders
 * until the session is resolved and allowed, so there is no flash.
 */
export function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useSession((state) => state.status);
  const principal = useSession((state) => state.principal);
  const target = status === "loading" ? null : gateRoute(pathname, status === "signed-in" ? principal : null);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (status === "loading" || target) return null;
  return <>{children}</>;
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { gateRoute } from "@/application/auth/route-gate";
import { useSession } from "@/state/session-store-provider";

/** The path part of a gate target (`/login?role=investor` → `/login`). */
function pathOf(target: string): string {
  return target.split(/[?#]/, 1)[0] ?? target;
}

/**
 * Client half of the route gating. The server proxy (`src/proxy.ts`) already
 * redirects before a protected page renders; this gate covers what happens
 * after load — signing out in another tab, a stale page restored from the
 * router cache — with the same `gateRoute` rules. Nothing protected renders
 * until the session is resolved and allowed, so there is no flash.
 *
 * - After this tab's own "Cerrar sesión" (`signedOutByUser`), the header owns
 *   the navigation to `/`; the gate targets `/` too instead of racing it to
 *   `/login`.
 * - It never redirects to the path it is already on and never repeats the
 *   same `router.replace`, so no render can start a redirect loop.
 */
export function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useSession((state) => state.status);
  const principal = useSession((state) => state.principal);
  const signedOutByUser = useSession((state) => state.signedOutByUser);
  const lastReplaced = useRef<string | null>(null);

  let target: string | null = null;
  if (status === "signed-out" && signedOutByUser) target = "/";
  else if (status !== "loading") target = gateRoute(pathname, status === "signed-in" ? principal : null);
  const redirect = target !== null && pathOf(target) !== pathname ? target : null;

  useEffect(() => {
    if (redirect === null) {
      lastReplaced.current = null;
      return;
    }
    if (lastReplaced.current === redirect) return;
    lastReplaced.current = redirect;
    router.replace(redirect);
  }, [redirect, router]);

  if (status === "loading" || target) return null;
  return <>{children}</>;
}

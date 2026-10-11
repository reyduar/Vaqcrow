"use client";

import Link from "next/link";
import { useSession } from "@/state/session-store-provider";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/**
 * 「Quiero financiar mi negocio」 — the hero's role-aware secondary CTA (owner
 * decision Q3.5, 2026-10-10). It is the landing's only client island: the hero
 * stays a server component and this reads the existing session store.
 *
 *   anonymous (signed-out) → `/signup`
 *   PYME                   → `/company`
 *   INVERSOR               → hidden
 *   ADMIN                  → hidden (same "not a PyME action" reasoning; the
 *                            owner named only INVERSOR, ADMIN is inferred)
 *
 * While the session is still loading nothing renders, so a signed-in role
 * never flashes the anonymous `/signup` link — the same choice `AppHeader`
 * makes for its auth actions.
 */
export function HeroAccountCta() {
  const status = useSession((state) => state.status);
  const role = useSession((state) => state.principal?.role ?? null);

  if (status === "loading") return null;
  if (status === "signed-in" && role !== "PYME") return null;

  const href = status === "signed-in" ? "/company" : "/signup";

  return (
    <Link
      href={href}
      className={`flex h-12 items-center rounded-control border border-control px-5 text-[15px] font-semibold text-text-primary no-underline hover:bg-page-surface ${FOCUS_RING}`}
    >
      Quiero financiar mi negocio
    </Link>
  );
}

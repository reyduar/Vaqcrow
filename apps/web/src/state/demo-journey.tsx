"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { parseJourneyParams } from "@/application/navigation/journey-params";
import { JourneyStoreProvider } from "./journey-store-provider";
import { JourneyUrlSync } from "./journey-url-sync";

function HydratedJourney({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  // The provider reads `initial` on its first render only: the URL seeds the
  // in-session store once, and the store owns the journey from then on.
  return (
    <JourneyStoreProvider initial={parseJourneyParams(searchParams)}>
      <JourneyUrlSync />
      {children}
    </JourneyStoreProvider>
  );
}

/**
 * The demo's journey boundary: one store per mounted demo, hydrated from the
 * URL. `useSearchParams` needs a `Suspense` boundary, and the store must exist
 * before any step renders, so the boundary wraps the whole shell.
 */
export function DemoJourney({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <HydratedJourney>{children}</HydratedJourney>
    </Suspense>
  );
}

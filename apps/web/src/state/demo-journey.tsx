"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { parseJourneyParams } from "@/application/navigation/journey-params";
import { JourneyStoreProvider } from "./journey-store-provider";
import { JourneyUrlSync } from "./journey-url-sync";

function HydratedJourney({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  // The provider reads `initial` on its first render only (the URL seeds the
  // store once); later navigations are applied by `JourneyUrlSync`, where the
  // URL wins when its ids change and the store wins after a local write.
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

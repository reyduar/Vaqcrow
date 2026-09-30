"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { mergeJourneyParams } from "@/application/navigation/journey-params";
import { useJourneyStore } from "./journey-store-provider";

/**
 * Keeps the current URL's journey params equal to the store, so a reload or a
 * shared link resumes the same journey. Renders nothing; it only replaces the
 * URL (never pushes history) and only when the two differ, which also scrubs
 * invalid ids a pasted link carried.
 */
export function JourneyUrlSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const applicationId = useJourneyStore((state) => state.applicationId);
  const campaignId = useJourneyStore((state) => state.campaignId);
  const distributionId = useJourneyStore((state) => state.distributionId);

  useEffect(() => {
    const current = searchParams.toString();
    const merged = mergeJourneyParams(new URLSearchParams(current), {
      applicationId,
      campaignId,
      distributionId
    }).toString();
    if (merged === current) return;
    router.replace(merged === "" ? pathname : `${pathname}?${merged}`);
  }, [router, pathname, searchParams, applicationId, campaignId, distributionId]);

  return null;
}

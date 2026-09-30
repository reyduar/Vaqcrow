"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { mergeJourneyParams, parseJourneyParams } from "@/application/navigation/journey-params";
import { useJourneyStore, useJourneyStoreApi } from "./journey-store-provider";

/**
 * Keeps the URL's journey params and the store in agreement, in two directions
 * that never fight:
 *
 * - URL -> store: when the search params change and the change is NOT the echo
 *   of a `router.replace` this component issued, the URL is a navigation (back,
 *   forward, a link with other ids) and wins: the store is hydrated from it.
 * - store -> URL: when the URL did not change but the store differs (a local
 *   write such as submitting a request, or invalid ids a pasted link carried),
 *   the URL is replaced (never pushed) to match the store.
 *
 * `lastQuery` is the last URL snapshot seen, which tells the two directions
 * apart; `ownWrites` holds the queries this component replaced to, so their
 * late echo is not mistaken for a navigation that would overwrite a newer
 * local write. Each effect pass does at most one of the two actions and both
 * are no-ops once URL and store agree, so the loop is bounded.
 */
export function JourneyUrlSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const store = useJourneyStoreApi();
  const applicationId = useJourneyStore((state) => state.applicationId);
  const campaignId = useJourneyStore((state) => state.campaignId);
  const distributionId = useJourneyStore((state) => state.distributionId);
  const query = searchParams.toString();
  const lastQuery = useRef(query);
  const ownWrites = useRef(new Set<string>());

  useEffect(() => {
    if (query !== lastQuery.current) {
      lastQuery.current = query;
      if (ownWrites.current.delete(query)) {
        // The echo of our own replace: not a navigation.
      } else {
        ownWrites.current.clear();
        const incoming = parseJourneyParams(new URLSearchParams(query));
        const held = store.getState();
        if (
          incoming.applicationId !== held.applicationId ||
          incoming.campaignId !== held.campaignId ||
          incoming.distributionId !== held.distributionId
        ) {
          store.getState().hydrate(incoming);
          return; // the store change re-runs this effect for any URL scrubbing
        }
      }
    }
    const merged = mergeJourneyParams(new URLSearchParams(query), {
      applicationId,
      campaignId,
      distributionId
    }).toString();
    if (merged === query) return;
    ownWrites.current.add(merged);
    router.replace(merged === "" ? pathname : `${pathname}?${merged}`);
  }, [router, pathname, query, store, applicationId, campaignId, distributionId]);

  return null;
}

"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `refresh` whenever the person comes back to this tab (Feature #557).
 * Friendbot opens in a new tab, so returning here is the moment the wallet's
 * balance may have changed; re-reading it then clears a stale «sin saldo»
 * warning without signing out or reloading the page.
 *
 * Listens to `visibilitychange` (only when the page becomes visible) and to
 * window `focus`. The latest `refresh` is kept in a ref so the listeners are
 * attached once per mount.
 */
export function useRefreshOnReturn(refresh: () => void): void {
  const latest = useRef(refresh);

  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    const onFocus = () => latest.current();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}

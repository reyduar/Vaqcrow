"use client";

import { useSyncExternalStore } from "react";

/**
 * The URL's fragment, as React state (#514).
 *
 * A fragment is client-only: `usePathname` does not carry it, `useSearchParams`
 * does not either, and it changes without a navigation. So it is read as an
 * external system with `useSyncExternalStore` — the pattern the theme switcher
 * already uses — instead of being mirrored into state from an effect: the server
 * snapshot is the empty fragment, the client snapshot is the real one, and React
 * reconciles the two without a cascading render.
 *
 * The role-aware header uses it to mark an in-page nav item current
 * (`/#como-funciona`), through the pure `isCurrentLink`.
 */
const EMPTY_HASH = "";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readHash(): string {
  return window.location.hash;
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, readHash, () => EMPTY_HASH);
}

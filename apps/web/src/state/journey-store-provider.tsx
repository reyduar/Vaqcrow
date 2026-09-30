"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createJourneyStore, type JourneyIds, type JourneyState, type JourneyStore } from "./journey-store";

const JourneyStoreContext = createContext<JourneyStore | undefined>(undefined);

/**
 * Creates one journey store per mounted provider (never a module-level
 * singleton). `initial` seeds identifiers for the first render only (tests and
 * deep-linked entry); it is never re-read.
 */
export function JourneyStoreProvider({
  children,
  initial
}: {
  children: ReactNode;
  initial?: Partial<JourneyIds>;
}) {
  const [store] = useState(() => createJourneyStore(initial));
  return <JourneyStoreContext.Provider value={store}>{children}</JourneyStoreContext.Provider>;
}

export function useJourneyStore<T>(selector: (state: JourneyState) => T): T {
  const store = useContext(JourneyStoreContext);
  if (!store) throw new Error("useJourneyStore must be used within a JourneyStoreProvider.");
  return useStore(store, selector);
}

"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createJourneyStore, type JourneyState, type JourneyStore } from "./journey-store";

const JourneyStoreContext = createContext<JourneyStore | undefined>(undefined);

/** Creates one journey store per mounted provider (never a module-level singleton). */
export function JourneyStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createJourneyStore());
  return <JourneyStoreContext.Provider value={store}>{children}</JourneyStoreContext.Provider>;
}

export function useJourneyStore<T>(selector: (state: JourneyState) => T): T {
  const store = useContext(JourneyStoreContext);
  if (!store) throw new Error("useJourneyStore must be used within a JourneyStoreProvider.");
  return useStore(store, selector);
}

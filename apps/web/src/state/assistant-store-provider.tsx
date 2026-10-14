"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import type { AssistantPort } from "@/application/assistant/assistant-port";
import { createBrowserAssistantPort } from "@/infrastructure/assistant/create-assistant-port";
import { createAssistantStore, type AssistantState, type AssistantStore } from "./assistant-store";

const AssistantStoreContext = createContext<AssistantStore | undefined>(undefined);

/**
 * Creates one assistant store per mounted provider (never a module-level
 * singleton) around the given port. The port is a prop so tests inject a double;
 * when omitted, production builds the browser port once for this mount.
 */
export function AssistantStoreProvider({
  children,
  port
}: {
  children: ReactNode;
  port?: AssistantPort;
}) {
  const [store] = useState(() => createAssistantStore(port ?? createBrowserAssistantPort()));
  return <AssistantStoreContext.Provider value={store}>{children}</AssistantStoreContext.Provider>;
}

/** The store itself, for actions and imperative reads. */
export function useAssistantStoreApi(): AssistantStore {
  const store = useContext(AssistantStoreContext);
  if (!store) throw new Error("useAssistantStoreApi must be used within an AssistantStoreProvider.");
  return store;
}

export function useAssistant<T>(selector: (state: AssistantState) => T): T {
  const store = useContext(AssistantStoreContext);
  if (!store) throw new Error("useAssistant must be used within an AssistantStoreProvider.");
  return useStore(store, selector);
}

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import type { AuthSessionPort } from "@/application/ports/auth-session-port";
import { createSessionStore, type SessionState, type SessionStore } from "./session-store";

const SessionStoreContext = createContext<SessionStore | undefined>(undefined);

/**
 * Creates one session store per mounted provider (never a module-level
 * singleton) around the given port, resolves the initial session and follows
 * later changes (sign-in elsewhere, token refresh, another tab). The port is a
 * prop so tests inject `FakeAuthSession`; it is read on the first render only.
 */
export function SessionStoreProvider({ children, port }: { children: ReactNode; port: AuthSessionPort }) {
  const [store] = useState(() => createSessionStore(port));
  const [sessionPort] = useState(port);

  useEffect(() => {
    void store.getState().refresh();
    return sessionPort.onSessionChange(() => {
      void store.getState().refresh();
    });
  }, [store, sessionPort]);

  return <SessionStoreContext.Provider value={store}>{children}</SessionStoreContext.Provider>;
}

/** The store itself, for actions and imperative reads. */
export function useSessionStoreApi(): SessionStore {
  const store = useContext(SessionStoreContext);
  if (!store) throw new Error("useSessionStoreApi must be used within a SessionStoreProvider.");
  return store;
}

export function useSession<T>(selector: (state: SessionState) => T): T {
  const store = useContext(SessionStoreContext);
  if (!store) throw new Error("useSession must be used within a SessionStoreProvider.");
  return useStore(store, selector);
}

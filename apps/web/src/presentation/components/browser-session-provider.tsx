"use client";

import { useState, type ReactNode } from "react";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import { SessionStoreProvider } from "@/state/session-store-provider";

/**
 * Mounts one session store per provider around the Supabase browser port; the
 * root layout mounts it once for the whole app.
 * The port is created per mount (never a module singleton) and built lazily,
 * so server prerendering never reads the Supabase configuration.
 */
export function BrowserSessionProvider({ children }: { children: ReactNode }) {
  const [port] = useState(() => createLazyAuthSession(createBrowserAuthSession));
  return <SessionStoreProvider port={port}>{children}</SessionStoreProvider>;
}

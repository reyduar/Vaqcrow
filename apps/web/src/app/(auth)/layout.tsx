import type { ReactNode } from "react";
import { BrowserSessionProvider } from "./browser-session-provider";

/** `/signup` and `/login`: outside the `(demo)` journey shell, with a real session. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <BrowserSessionProvider>{children}</BrowserSessionProvider>;
}

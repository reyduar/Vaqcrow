/**
 * Test-only routing harness.
 *
 * Makes `usePathname` a real reactive hook and `next/link` a real
 * click-driven navigator, backed by a React context instead of a mutable
 * variable + manual `rerender()`. State updates happen inside
 * `fireEvent.click`, which Testing Library already wraps in `act()`, so
 * every consumer re-renders naturally.
 *
 * Imports `react` only (no `next/*`) to avoid module cycles with the
 * `vi.mock("next/navigation" | "next/link", ...)` factories that consume it.
 *
 * Not collected as a test suite: vitest's `include` glob only matches
 * `src/**\/*.test.{ts,tsx}`, and this file has no `.test.` segment.
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useState } from "react";

export interface RouteHarnessValue {
  readonly pathname: string;
  readonly navigate: (to: string) => void;
}

const RouteContext = createContext<RouteHarnessValue>({
  pathname: "/",
  navigate: () => {}
});

export interface RouteHarnessProps {
  readonly initialPathname: string;
  readonly children: ReactNode;
}

export function RouteHarness({ initialPathname, children }: RouteHarnessProps) {
  const [pathname, setPathname] = useState(initialPathname);

  return (
    <RouteContext.Provider value={{ pathname, navigate: setPathname }}>
      {children}
    </RouteContext.Provider>
  );
}

export function useHarnessPathname(): string {
  return useContext(RouteContext).pathname;
}

export interface HarnessLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly href: string;
  readonly children?: ReactNode;
}

export function HarnessLink({ href, children, ...anchorProps }: HarnessLinkProps) {
  const { navigate } = useContext(RouteContext);

  return (
    <a
      {...anchorProps}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}

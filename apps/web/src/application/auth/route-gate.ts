import type { AccountRole, PrincipalRole } from "@/application/ports/auth-session-port";
import { authHref, homeRouteFor } from "./auth-form";

/**
 * Route gating by session and role, React-free and vendor-free. Both the
 * server proxy (`src/proxy.ts`) and the client `RouteGate` use it, so the two
 * layers can never disagree.
 *
 * The role always comes from the verified profile (the session port or the
 * proxy's profile read), never from the URL or JWT claims.
 */
const PROTECTED: Readonly<Record<string, AccountRole>> = Object.freeze({
  "/portfolio": "INVERSOR",
  "/company": "PYME"
});

const AUTH_PAGES: readonly string[] = Object.freeze(["/login", "/signup"]);

/** Every path the proxy must run on (its `matcher`). */
export const GATED_PATHS: readonly string[] = Object.freeze([...Object.keys(PROTECTED), ...AUTH_PAGES]);

function sectionOf(pathname: string, roots: readonly string[]): string | undefined {
  return roots.find((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/**
 * Where a visit must go instead, or `null` to let it through:
 * - anonymous on a protected page → `/login` with the page's role preselected;
 * - signed in with another role → that role's own home (`ADMIN` → `/`);
 * - signed in on `/login` or `/signup` → their home.
 */
export function gateRoute(pathname: string, principal: { readonly role: PrincipalRole } | null): string | null {
  const protectedRoot = sectionOf(pathname, Object.keys(PROTECTED));
  if (protectedRoot) {
    const required = PROTECTED[protectedRoot]!;
    if (!principal) return authHref("login", required);
    return principal.role === required ? null : homeRouteFor(principal.role);
  }
  if (sectionOf(pathname, AUTH_PAGES) && principal) return homeRouteFor(principal.role);
  return null;
}

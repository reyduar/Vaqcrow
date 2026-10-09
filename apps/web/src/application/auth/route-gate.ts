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

/**
 * Paths any signed-in role may see (owner decision D1: `/reports` is reachable
 * by every authenticated role). An anonymous visitor is sent to the neutral
 * sign-in with no role preselected; `authHref` always requires a role, so the
 * `/login` target is named directly rather than through it.
 */
const AUTHENTICATED_PATHS: readonly string[] = Object.freeze(["/reports"]);

const AUTHENTICATED_LOGIN_TARGET = "/login";

const AUTH_PAGES: readonly string[] = Object.freeze(["/login", "/signup"]);

/** Every path the proxy must run on (its `matcher`). */
export const GATED_PATHS: readonly string[] = Object.freeze([
  ...Object.keys(PROTECTED),
  ...AUTHENTICATED_PATHS,
  ...AUTH_PAGES
]);

function sectionOf(pathname: string, roots: readonly string[]): string | undefined {
  return roots.find((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/**
 * Where a visit must go instead, or `null` to let it through:
 * - anonymous on a protected page → `/login` with the page's role preselected;
 * - anonymous on an authenticated page → `/login` with no role preselected;
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
  if (sectionOf(pathname, AUTHENTICATED_PATHS)) return principal ? null : AUTHENTICATED_LOGIN_TARGET;
  if (sectionOf(pathname, AUTH_PAGES) && principal) return homeRouteFor(principal.role);
  return null;
}

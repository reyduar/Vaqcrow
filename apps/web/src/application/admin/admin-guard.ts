import type { PrincipalRole } from "@/application/ports/auth-session-port";

/**
 * Pure route decisions for the admin console (Feature #386 / D2), React-free
 * and vendor-free so the client gate and its tests share one authoritative
 * shape.
 *
 * The role always comes from the verified profile, never from a URL or a JWT
 * claim. A signed-out visitor and a signed-in non-admin get the **same**
 * decision — `deny` — so the console never reveals itself by redirecting a
 * non-admin somewhere different from an anonymous visit.
 */

export const ADMIN_LOGIN_PATH = "/admin";

/** `/admin/pymes` is the console's first route. */
export const ADMIN_CONSOLE_PATH = "/admin/pymes";

export type SessionGateStatus = "loading" | "signed-out" | "signed-in";

export type AdminConsoleDecision = "wait" | "allow" | "deny";

/** What `/admin/<console>` does with the current session. */
export function adminConsoleDecision(status: SessionGateStatus, role: PrincipalRole | null): AdminConsoleDecision {
  if (status === "loading") return "wait";
  if (status === "signed-in" && role === "ADMIN") return "allow";
  return "deny";
}

export type AdminLoginDecision = "wait" | "render" | "enter";

/** What `/admin` does with the current session. */
export function adminLoginDecision(status: SessionGateStatus, role: PrincipalRole | null): AdminLoginDecision {
  if (status === "loading") return "wait";
  if (status === "signed-in" && role === "ADMIN") return "enter";
  return "render";
}

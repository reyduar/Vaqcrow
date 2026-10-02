import type { FastifyInstance } from "fastify";
import type { AuthPort, Principal, Role } from "../../../application/ports/auth-port.js";
import { buildApp } from "../build-app.js";

type BuildAppDependencies = NonNullable<Parameters<typeof buildApp>[0]>;

/** Test tokens are `<role>` or `<role>-inactive`; anything else is unauthenticated. */
export function tokenFor(role: Role, status: "active" | "inactive" = "active"): string {
  return status === "active" ? `test-${role}` : `test-${role}-inactive`;
}

export function principalFor(role: Role, status: "active" | "inactive" = "active"): Principal {
  return { userId: `00000000-0000-4000-8000-00000000000${role.length}`, role, status, displayName: `Test ${role}` };
}

export function bearer(role: Role, status: "active" | "inactive" = "active"): { authorization: string } {
  return { authorization: `Bearer ${tokenFor(role, status)}` };
}

export const ADMIN_DISPLAY_NAME = principalFor("ADMIN").displayName;

/** A hand-written port: no network, no Supabase. */
export function fakeAuthPort(overrides: Partial<AuthPort> = {}): AuthPort {
  const roles: readonly Role[] = ["PYME", "INVERSOR", "ADMIN"];
  return {
    verifyAccessToken: async (token) => {
      for (const role of roles) {
        if (token === tokenFor(role)) return { ok: true, value: principalFor(role) };
        if (token === tokenFor(role, "inactive")) return { ok: true, value: principalFor(role, "inactive") };
      }
      return { ok: false, error: { code: "unauthenticated" } };
    },
    ...overrides
  };
}

/**
 * Builds the real app behind the default-deny hook and makes every `inject`
 * carry the given role's bearer token unless the call sets its own
 * `authorization` header. Assertions in the calling tests are untouched.
 */
export function buildAppAs(
  role: Role,
  dependencies: Omit<BuildAppDependencies, "auth"> = {}
): FastifyInstance {
  const app = buildApp({ ...dependencies, auth: { port: fakeAuthPort() } });
  const inject = app.inject.bind(app) as (options: Record<string, unknown>) => unknown;
  (app as unknown as { inject: unknown }).inject = (options: Record<string, unknown>) => {
    const headers = { ...(options["headers"] as Record<string, string> | undefined) };
    const hasAuthorization = Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
    return inject(hasAuthorization ? options : { ...options, headers: { ...bearer(role), ...headers } });
  };
  return app;
}

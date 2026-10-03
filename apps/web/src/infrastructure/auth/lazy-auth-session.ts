import {
  AuthSessionError,
  type AuthSessionPort,
  type SessionPrincipal,
  type SessionSnapshot,
  type SignInInput,
  type SignUpInput,
  type SignUpOutcome
} from "@/application/ports/auth-session-port";

/**
 * Defers building the real port until its first call.
 *
 * Why: the auth pages are prerendered on the server, where the provider's
 * `useState` initializer also runs, and `createBrowserAuthSession()` throws
 * `SupabaseConfigError` when the `NEXT_PUBLIC_SUPABASE_*` variables are
 * missing. Deferring keeps rendering safe; the first real call happens in an
 * effect on the client. A factory that throws becomes a sanitized
 * `unavailable` failure (the error itself is never surfaced), `getAccessToken`
 * keeps its never-rejects contract and `onSessionChange` becomes a no-op.
 */
export function createLazyAuthSession(factory: () => AuthSessionPort): AuthSessionPort {
  let resolved: { port: AuthSessionPort } | { port: null } | undefined;

  function port(): AuthSessionPort | null {
    if (!resolved) {
      try {
        resolved = { port: factory() };
      } catch {
        resolved = { port: null };
      }
    }
    return resolved.port;
  }

  function required(): AuthSessionPort {
    const current = port();
    if (!current) throw new AuthSessionError("unavailable");
    return current;
  }

  return {
    signUp: async (input: SignUpInput): Promise<SignUpOutcome> => required().signUp(input),
    signIn: async (input: SignInInput): Promise<SessionPrincipal> => required().signIn(input),
    signOut: async (): Promise<void> => required().signOut(),
    getSession: async (): Promise<SessionSnapshot> => required().getSession(),
    getAccessToken: async (): Promise<string | null> => port()?.getAccessToken() ?? null,
    onSessionChange: (listener: () => void): (() => void) => port()?.onSessionChange(listener) ?? (() => undefined)
  };
}

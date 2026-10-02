import { createStore, type StoreApi } from "zustand/vanilla";
import {
  AuthSessionError,
  type AuthErrorCode,
  type AuthSessionPort,
  type SessionPrincipal,
  type SignInInput,
  type SignUpInput,
  type SignUpOutcome
} from "@/application/ports/auth-session-port";

/**
 * Client view of the signed-in session.
 *
 * Boundary: the principal holds the verified role and display name only —
 * never the email or the token. The port is authoritative; this store is a
 * per-mount cache created through `SessionStoreProvider`, never a module
 * singleton.
 */
export type SessionStatus = "loading" | "signed-out" | "signed-in";

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; code: AuthErrorCode };

export interface SessionData {
  status: SessionStatus;
  principal: SessionPrincipal | null;
  /** Code of the last failed session read (not of sign-in/sign-up attempts). */
  error: AuthErrorCode | null;
}

export interface SessionActions {
  /** Re-reads the session from the port; a newer read or action always wins. */
  refresh: () => Promise<void>;
  signIn: (input: SignInInput) => Promise<ActionResult<{ principal: SessionPrincipal }>>;
  signUp: (input: SignUpInput) => Promise<ActionResult<{ status: SignUpOutcome["status"] }>>;
  signOut: () => Promise<ActionResult>;
}

export type SessionState = SessionData & SessionActions;
export type SessionStore = StoreApi<SessionState>;

function codeOf(error: unknown): AuthErrorCode {
  return error instanceof AuthSessionError ? error.code : "unavailable";
}

export function createSessionStore(port: AuthSessionPort): SessionStore {
  // Every write takes a ticket; a result whose ticket is stale is dropped.
  let latest = 0;

  return createStore<SessionState>()((set) => ({
    status: "loading",
    principal: null,
    error: null,

    refresh: async () => {
      const ticket = ++latest;
      try {
        const snapshot = await port.getSession();
        if (ticket !== latest) return;
        set(
          snapshot.status === "signed-in"
            ? { status: "signed-in", principal: snapshot.principal, error: null }
            : { status: "signed-out", principal: null, error: null }
        );
      } catch (error) {
        if (ticket !== latest) return;
        set({ status: "signed-out", principal: null, error: codeOf(error) });
      }
    },

    signIn: async (input) => {
      const ticket = ++latest;
      try {
        const principal = await port.signIn(input);
        if (ticket === latest) set({ status: "signed-in", principal, error: null });
        return { ok: true, principal };
      } catch (error) {
        return { ok: false, code: codeOf(error) };
      }
    },

    signUp: async (input) => {
      try {
        const outcome = await port.signUp(input);
        return { ok: true, status: outcome.status };
      } catch (error) {
        return { ok: false, code: codeOf(error) };
      }
    },

    signOut: async () => {
      const ticket = ++latest;
      try {
        await port.signOut();
        if (ticket === latest) set({ status: "signed-out", principal: null, error: null });
        return { ok: true };
      } catch (error) {
        return { ok: false, code: codeOf(error) };
      }
    }
  }));
}

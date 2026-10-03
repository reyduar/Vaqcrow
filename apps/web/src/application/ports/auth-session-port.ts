/**
 * Session capability of the web app: account creation, sign-in, sign-out and
 * the signed-in principal. Vendor-free and React-free; the Supabase adapter
 * lives in `infrastructure/auth/`.
 *
 * Privacy boundary: the principal carries the verified role and display name
 * only. The email never leaves the adapter, so nothing that renders UI can
 * show it. The role is always read from the user's own `public.profile` row,
 * never from JWT claims or form input.
 */

/** Roles a person can choose at signup. `ADMIN` is never self-assigned. */
export type AccountRole = "PYME" | "INVERSOR";

/** Roles a signed-in profile can hold. */
export type PrincipalRole = AccountRole | "ADMIN";

export interface SessionPrincipal {
  readonly role: PrincipalRole;
  readonly displayName: string;
}

export type SessionSnapshot =
  | { readonly status: "signed-out" }
  | { readonly status: "signed-in"; readonly principal: SessionPrincipal };

export interface SignUpInput {
  readonly role: AccountRole;
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  /** Where the confirmation link lands; the provider default when omitted. */
  readonly emailRedirectTo?: string;
}

export interface SignInInput {
  readonly email: string;
  readonly password: string;
}

/**
 * `confirmation_required`: the account exists and must be confirmed from the
 * emailed link before signing in. `signed_in`: the provider opened a session
 * right away (email confirmation disabled).
 */
export type SignUpOutcome = { readonly status: "confirmation_required" } | { readonly status: "signed_in" };

/**
 * Sanitized failure codes. Provider messages never travel through this
 * channel; screens pick their own copy per code.
 * - `email_taken` is reported only when the provider says so explicitly; with
 *   email confirmation on, Supabase hides existing accounts on purpose.
 * - `unavailable` covers provider/server failures and a session without a
 *   readable profile.
 */
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "email_taken"
  | "weak_password"
  | "invalid_input"
  | "rate_limited"
  | "network"
  | "unavailable";

export const AUTH_ERROR_CODES: readonly AuthErrorCode[] = Object.freeze([
  "invalid_credentials",
  "email_not_confirmed",
  "email_taken",
  "weak_password",
  "invalid_input",
  "rate_limited",
  "network",
  "unavailable"
]);

/** Sanitized failure of an `AuthSessionPort` call: a code and nothing else. */
export class AuthSessionError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(`Authentication failed: ${code}`);
    this.name = "AuthSessionError";
    this.code = code;
  }

  toJSON(): { name: string; code: AuthErrorCode } {
    return { name: this.name, code: this.code };
  }
}

export interface AuthSessionPort {
  /** Rejects with `AuthSessionError`. */
  signUp(input: SignUpInput): Promise<SignUpOutcome>;
  /** Resolves the verified principal; rejects with `AuthSessionError`. */
  signIn(input: SignInInput): Promise<SessionPrincipal>;
  /** Rejects with `AuthSessionError`. */
  signOut(): Promise<void>;
  /** Current session and its profile; rejects with `AuthSessionError` when the profile cannot be read. */
  getSession(): Promise<SessionSnapshot>;
  /** The current access token, or `null` when signed out. Never rejects. */
  getAccessToken(): Promise<string | null>;
  /**
   * Notifies after the session changes (sign-in, sign-out, refresh, another
   * tab). Listeners re-read `getSession()`; the notification itself carries
   * nothing. Returns the unsubscribe function.
   */
  onSessionChange(listener: () => void): () => void;
}

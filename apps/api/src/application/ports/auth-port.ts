export type Role = "PYME" | "INVERSOR" | "ADMIN";

/** The verified identity behind a request. Built only from a validated token and the stored profile. */
export interface Principal {
  readonly userId: string;
  readonly role: Role;
  readonly status: "active" | "inactive";
  readonly displayName: string;
}

export type AuthErrorCode = "unauthenticated" | "unavailable";

export type AuthResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: AuthErrorCode } };

export interface AuthPort {
  /**
   * Validates the bearer token with the identity provider and resolves the
   * stored profile. `unauthenticated` covers an invalid or expired token and a
   * missing profile; `unavailable` covers provider or database failures.
   */
  verifyAccessToken(token: string): Promise<AuthResult<Principal>>;
}

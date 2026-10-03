import {
  AuthSessionError,
  type AccountRole,
  type SignInInput,
  type SignUpInput
} from "@/application/ports/auth-session-port";

/** Mirrors the signup trigger: at least 2 characters after trim; the profile column caps at 120. */
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 120;

const ACCOUNT_ROLES: readonly AccountRole[] = ["PYME", "INVERSOR"];

function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === "string" && (ACCOUNT_ROLES as readonly string[]).includes(value);
}

function normalizeEmail(email: unknown): string {
  const trimmed = typeof email === "string" ? email.trim() : "";
  // Shape check only: the provider owns real email validation.
  if (trimmed === "" || !trimmed.includes("@")) throw new AuthSessionError("invalid_input");
  return trimmed;
}

function requirePassword(password: unknown): string {
  if (typeof password !== "string" || password === "") throw new AuthSessionError("invalid_input");
  return password;
}

/**
 * Validates and normalizes a signup request before it reaches the provider.
 * Rejects with `invalid_input`; `ADMIN` is never accepted here.
 */
export function normalizeSignUpInput(input: SignUpInput): SignUpInput {
  if (!isAccountRole(input.role)) throw new AuthSessionError("invalid_input");
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  if (displayName.length < DISPLAY_NAME_MIN_LENGTH || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new AuthSessionError("invalid_input");
  }
  return {
    role: input.role,
    displayName,
    email: normalizeEmail(input.email),
    password: requirePassword(input.password),
    ...(input.emailRedirectTo !== undefined ? { emailRedirectTo: input.emailRedirectTo } : {})
  };
}

/** Validates and normalizes a sign-in request. Rejects with `invalid_input`. */
export function normalizeSignInInput(input: SignInInput): SignInInput {
  return { email: normalizeEmail(input.email), password: requirePassword(input.password) };
}

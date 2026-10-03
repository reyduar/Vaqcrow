import { AuthSessionError, type AuthErrorCode } from "@/application/ports/auth-session-port";

/**
 * Supabase Auth error codes (`AuthError.code`) mapped to the sanitized port
 * codes. Anything not listed becomes `unavailable`.
 */
const CODE_MAP: Readonly<Record<string, AuthErrorCode>> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  user_already_exists: "email_taken",
  email_exists: "email_taken",
  weak_password: "weak_password",
  validation_failed: "invalid_input",
  email_address_invalid: "invalid_input",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited"
};

function field(error: unknown, key: "name" | "code" | "status"): unknown {
  return typeof error === "object" && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;
}

/**
 * Maps any Supabase Auth / PostgREST / fetch failure to an `AuthSessionError`.
 * Reads only `name`, `code` and `status`; the provider `message`, `details`
 * and `hint` are dropped so emails, tokens or SQL hints never reach callers.
 */
export function toAuthSessionError(error: unknown): AuthSessionError {
  if (error instanceof AuthSessionError) return error;
  if (error instanceof TypeError) return new AuthSessionError("network");

  const name = field(error, "name");
  const code = field(error, "code");
  const status = field(error, "status");

  if (name === "AuthRetryableFetchError" || status === 0) return new AuthSessionError("network");
  if (typeof code === "string" && Object.hasOwn(CODE_MAP, code)) return new AuthSessionError(CODE_MAP[code]!);
  if (status === 429) return new AuthSessionError("rate_limited");
  return new AuthSessionError("unavailable");
}

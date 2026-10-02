import { describe, expect, it } from "vitest";
import { AuthSessionError } from "@/application/ports/auth-session-port";
import { toAuthSessionError } from "./supabase-auth-errors";

const LEAK = "provider detail ana@example.test token=abc";

/** Mimics the shape of supabase-js `AuthError` subclasses without importing them. */
function authError(name: string, status: number | undefined, code?: string): Error {
  return Object.assign(new Error(LEAK), { name, status, code, __isAuthError: true });
}

describe("toAuthSessionError", () => {
  it.each([
    ["invalid_credentials", authError("AuthApiError", 400, "invalid_credentials"), "invalid_credentials"],
    ["email_not_confirmed", authError("AuthApiError", 400, "email_not_confirmed"), "email_not_confirmed"],
    ["user_already_exists", authError("AuthApiError", 422, "user_already_exists"), "email_taken"],
    ["email_exists", authError("AuthApiError", 422, "email_exists"), "email_taken"],
    ["weak_password", authError("AuthWeakPasswordError", 422, "weak_password"), "weak_password"],
    ["validation_failed", authError("AuthApiError", 400, "validation_failed"), "invalid_input"],
    ["email_address_invalid", authError("AuthApiError", 400, "email_address_invalid"), "invalid_input"],
    ["over_request_rate_limit", authError("AuthApiError", 429, "over_request_rate_limit"), "rate_limited"],
    ["over_email_send_rate_limit", authError("AuthApiError", 429, "over_email_send_rate_limit"), "rate_limited"],
    ["a 429 without a code", authError("AuthApiError", 429), "rate_limited"],
    ["a retryable fetch error", authError("AuthRetryableFetchError", 0), "network"],
    ["a status-0 auth error", authError("AuthUnknownError", 0), "network"],
    ["a raw fetch TypeError", new TypeError("Failed to fetch"), "network"],
    ["a 500 auth error", authError("AuthApiError", 500, "unexpected_failure"), "unavailable"],
    ["an unknown code", authError("AuthApiError", 400, "something_new"), "unavailable"],
    ["a PostgREST error object", { code: "PGRST301", message: LEAK, details: LEAK, hint: LEAK }, "unavailable"],
    ["a non-error value", "boom", "unavailable"],
    ["undefined", undefined, "unavailable"]
  ])("maps %s to %s", (_label, input, expected) => {
    const mapped = toAuthSessionError(input);
    expect(mapped).toBeInstanceOf(AuthSessionError);
    expect(mapped.code).toBe(expected);
  });

  it("never carries the provider message, email or token", () => {
    const mapped = toAuthSessionError(authError("AuthApiError", 400, "invalid_credentials"));
    expect(mapped.message).not.toContain("provider detail");
    expect(JSON.stringify(mapped)).not.toContain("ana@example.test");
    expect(JSON.stringify(mapped)).not.toContain("token=abc");
    expect(String(mapped)).not.toContain(LEAK);
  });

  it("passes an existing AuthSessionError through unchanged", () => {
    const original = new AuthSessionError("invalid_input");
    expect(toAuthSessionError(original)).toBe(original);
  });
});

import { describe, expect, it } from "vitest";
import { AuthSessionError } from "@/application/ports/auth-session-port";
import { normalizeSignInInput, normalizeSignUpInput } from "./sign-up-input";

const valid = { role: "INVERSOR", displayName: "  Ana Pérez ", email: " ana@example.test ", password: "secret-123" } as const;

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof AuthSessionError ? error.code : "not-an-auth-error";
  }
  return undefined;
}

describe("normalizeSignUpInput", () => {
  it("trims the display name and email and keeps the password untouched", () => {
    expect(normalizeSignUpInput({ ...valid, password: " spaced " })).toEqual({
      role: "INVERSOR",
      displayName: "Ana Pérez",
      email: "ana@example.test",
      password: " spaced "
    });
  });

  it("keeps an emailRedirectTo when given", () => {
    expect(normalizeSignUpInput({ ...valid, emailRedirectTo: "https://web.example.test/login" }).emailRedirectTo).toBe(
      "https://web.example.test/login"
    );
  });

  it.each([
    ["an ADMIN role", { role: "ADMIN" }],
    ["an unknown role", { role: "pyme" }],
    ["a blank display name", { displayName: "   " }],
    ["a one-character display name", { displayName: " A " }],
    ["a display name over 120 characters", { displayName: "x".repeat(121) }],
    ["a blank email", { email: "  " }],
    ["an email without @", { email: "ana.example.test" }],
    ["an empty password", { password: "" }]
  ])("rejects %s as invalid_input", (_label, patch) => {
    expect(codeOf(() => normalizeSignUpInput({ ...valid, ...patch } as never))).toBe("invalid_input");
  });
});

describe("normalizeSignInInput", () => {
  it("trims the email only", () => {
    expect(normalizeSignInInput({ email: " ana@example.test ", password: " p " })).toEqual({
      email: "ana@example.test",
      password: " p "
    });
  });

  it.each([
    ["a blank email", { email: " ", password: "p" }],
    ["an empty password", { email: "ana@example.test", password: "" }]
  ])("rejects %s as invalid_input", (_label, input) => {
    expect(codeOf(() => normalizeSignInInput(input))).toBe("invalid_input");
  });
});

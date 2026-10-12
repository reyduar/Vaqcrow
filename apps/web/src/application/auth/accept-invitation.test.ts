import { describe, expect, it } from "vitest";
import {
  ACCEPT_COPY,
  ACCEPT_INVITATION_PATH,
  credentialErrorMessage,
  gatewayErrorMessage,
  MISSING_SESSION_COPY,
  validateAcceptInvitationForm
} from "./accept-invitation";

/**
 * The operator invitation acceptance model (#390/WU5): pure validation and the
 * sanitized copy per failure code. The screen renders it; no React, no vendor.
 */
describe("accept-invitation model", () => {
  it("serves the English path the invite email links to", () => {
    expect(ACCEPT_INVITATION_PATH).toBe("/accept-invitation");
  });

  it("accepts a valid form, trimming the display name", () => {
    const result = validateAcceptInvitationForm({
      displayName: "  Ana Operadora  ",
      password: "secret-123",
      confirmPassword: "secret-123"
    });

    expect(result.valid).toBe(true);
    expect(result.displayName).toBeNull();
    expect(result.password).toBeNull();
    expect(result.confirmPassword).toBeNull();
  });

  it("requires a display name, a strong password and a matching confirmation", () => {
    const missingName = validateAcceptInvitationForm({
      displayName: " ",
      password: "secret-123",
      confirmPassword: "secret-123"
    });
    expect(missingName.valid).toBe(false);
    expect(missingName.displayName).toBe(ACCEPT_COPY.nameError);

    const shortPassword = validateAcceptInvitationForm({
      displayName: "Ana",
      password: "short",
      confirmPassword: "short"
    });
    expect(shortPassword.valid).toBe(false);
    expect(shortPassword.password).toBe(ACCEPT_COPY.passwordError);

    const mismatch = validateAcceptInvitationForm({
      displayName: "Ana",
      password: "secret-123",
      confirmPassword: "secret-124"
    });
    expect(mismatch.valid).toBe(false);
    expect(mismatch.confirmPassword).toBe(ACCEPT_COPY.confirmMismatch);
  });

  it("never reports a password rule as satisfied when it is only the confirmation", () => {
    const result = validateAcceptInvitationForm({
      displayName: "Ana",
      password: "",
      confirmPassword: ""
    });
    expect(result.valid).toBe(false);
    expect(result.password).not.toBeNull();
  });

  it("maps the credential codes to their own copy, never the provider message", () => {
    expect(credentialErrorMessage("weak_password").title).toBe("No pudimos guardar tu contraseña.");
    expect(credentialErrorMessage("network").kind).toBe("network");
    expect(credentialErrorMessage("unavailable").detail).toBeTruthy();
  });

  it("maps the API gateway codes to their own copy", () => {
    expect(gatewayErrorMessage("unauthenticated").title).toBe("Tu sesión venció.");
    expect(gatewayErrorMessage("unavailable").kind).toBe("rejected");
    expect(gatewayErrorMessage("network").kind).toBe("network");
  });

  it("has honest copy for a missing or expired invitation session", () => {
    expect(MISSING_SESSION_COPY.title).toBeTruthy();
    expect(MISSING_SESSION_COPY.detail.length).toBeGreaterThan(0);
    expect(MISSING_SESSION_COPY.cta).toBeTruthy();
  });
});

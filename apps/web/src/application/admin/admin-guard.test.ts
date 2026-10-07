import { describe, expect, it } from "vitest";
import { ADMIN_LOGIN_PATH, adminConsoleDecision, adminLoginDecision } from "./admin-guard";

describe("adminConsoleDecision", () => {
  it("waits while the session is still loading", () => {
    expect(adminConsoleDecision("loading", null)).toBe("wait");
  });

  it("denies a signed-out visitor", () => {
    expect(adminConsoleDecision("signed-out", null)).toBe("deny");
  });

  it("denies a signed-in non-admin without revealing the console", () => {
    expect(adminConsoleDecision("signed-in", "PYME")).toBe("deny");
    expect(adminConsoleDecision("signed-in", "INVERSOR")).toBe("deny");
  });

  it("allows a verified ADMIN", () => {
    expect(adminConsoleDecision("signed-in", "ADMIN")).toBe("allow");
  });
});

describe("adminLoginDecision", () => {
  it("waits while the session is still loading", () => {
    expect(adminLoginDecision("loading", null)).toBe("wait");
  });

  it("sends a signed-in ADMIN straight to the console", () => {
    expect(adminLoginDecision("signed-in", "ADMIN")).toBe("enter");
  });

  it("renders the login for a signed-out visitor", () => {
    expect(adminLoginDecision("signed-out", null)).toBe("render");
  });

  it("renders the login for a signed-in non-admin", () => {
    expect(adminLoginDecision("signed-in", "INVERSOR")).toBe("render");
  });
});

describe("admin console path", () => {
  it("is the login route the guard denies towards", () => {
    expect(ADMIN_LOGIN_PATH).toBe("/admin");
  });
});

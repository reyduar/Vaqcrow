import { describe, expect, it } from "vitest";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import { gateRoute, GATED_PATHS } from "./route-gate";

const as = (role: PrincipalRole) => ({ role });

describe("gateRoute", () => {
  it.each([
    ["/portfolio", "/login?role=investor"],
    ["/company", "/login?role=pyme"],
    ["/portfolio/anything", "/login?role=investor"],
    ["/reports", "/login"],
    ["/reports/ventas", "/login"]
  ] as const)("anonymous on %s → %s", (pathname, target) => {
    expect(gateRoute(pathname, null)).toBe(target);
  });

  it.each(["INVERSOR", "PYME", "ADMIN"] as const)("%s on /reports is let through", (role) => {
    expect(gateRoute("/reports", as(role))).toBeNull();
    expect(gateRoute("/reports/ventas", as(role))).toBeNull();
  });

  it.each([
    ["/portfolio", "INVERSOR", null],
    ["/company", "PYME", null],
    ["/portfolio", "PYME", "/company"],
    ["/company", "INVERSOR", "/portfolio"],
    ["/portfolio", "ADMIN", "/"],
    ["/company", "ADMIN", "/"]
  ] as const)("%s as %s → %s", (pathname, role, target) => {
    expect(gateRoute(pathname, as(role))).toBe(target);
  });

  it.each([
    ["/login", "INVERSOR", "/portfolio"],
    ["/signup", "PYME", "/company"],
    ["/login", "ADMIN", "/"]
  ] as const)("signed in on %s as %s → %s", (pathname, role, target) => {
    expect(gateRoute(pathname, as(role))).toBe(target);
  });

  it.each(["/login", "/signup"])("anonymous on %s stays", (pathname) => {
    expect(gateRoute(pathname, null)).toBeNull();
  });

  it.each(["/", "/help", "/explore", "/portfolios", "/companyx"])("leaves %s alone", (pathname) => {
    expect(gateRoute(pathname, null)).toBeNull();
    expect(gateRoute(pathname, as("PYME"))).toBeNull();
  });

  it("lists the gated paths the proxy must match", () => {
    expect([...GATED_PATHS].sort()).toEqual(["/company", "/login", "/portfolio", "/reports", "/signup"]);
  });
});

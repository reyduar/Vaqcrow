import { describe, expect, it } from "vitest";
import { canDeactivateUser, isRoleChangeAllowed, roleChangeTargets } from "./admin-users.js";

describe("isRoleChangeAllowed", () => {
  it("allows PYME ↔ INVERSOR", () => {
    expect(isRoleChangeAllowed("PYME", "INVERSOR")).toBe(true);
    expect(isRoleChangeAllowed("INVERSOR", "PYME")).toBe(true);
  });

  it("rejects any change involving ADMIN", () => {
    expect(isRoleChangeAllowed("PYME", "ADMIN")).toBe(false);
    expect(isRoleChangeAllowed("INVERSOR", "ADMIN")).toBe(false);
    expect(isRoleChangeAllowed("ADMIN", "PYME")).toBe(false);
    expect(isRoleChangeAllowed("ADMIN", "INVERSOR")).toBe(false);
  });

  it("rejects a change to the same role", () => {
    expect(isRoleChangeAllowed("PYME", "PYME")).toBe(false);
    expect(isRoleChangeAllowed("ADMIN", "ADMIN")).toBe(false);
  });
});

describe("roleChangeTargets", () => {
  it("offers the opposite role for PYME and INVERSOR", () => {
    expect(roleChangeTargets("PYME")).toEqual(["INVERSOR"]);
    expect(roleChangeTargets("INVERSOR")).toEqual(["PYME"]);
  });

  it("offers nothing for ADMIN", () => {
    expect(roleChangeTargets("ADMIN")).toEqual([]);
  });
});

describe("canDeactivateUser", () => {
  it("allows deactivating an active, non-self, non-admin user", () => {
    expect(
      canDeactivateUser({ isSelf: false, role: "INVERSOR", active: true, activeAdminCount: 1 })
    ).toEqual({ ok: true });
  });

  it("rejects an already inactive account", () => {
    expect(
      canDeactivateUser({ isSelf: false, role: "PYME", active: false, activeAdminCount: 1 })
    ).toEqual({ ok: false, code: "already_inactive" });
  });

  it("rejects deactivating the signed-in admin's own account", () => {
    expect(
      canDeactivateUser({ isSelf: true, role: "ADMIN", active: true, activeAdminCount: 3 })
    ).toEqual({ ok: false, code: "self" });
  });

  it("protects the last active admin", () => {
    expect(
      canDeactivateUser({ isSelf: false, role: "ADMIN", active: true, activeAdminCount: 1 })
    ).toEqual({ ok: false, code: "last_admin" });
  });

  it("allows deactivating an admin when another active admin remains", () => {
    expect(
      canDeactivateUser({ isSelf: false, role: "ADMIN", active: true, activeAdminCount: 2 })
    ).toEqual({ ok: true });
  });
});

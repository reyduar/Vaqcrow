/**
 * Admin › Usuarios (Feature #390) domain rules — pure and framework-free.
 *
 * The owner's decisions (2026-10-12) are encoded here: a role change is limited
 * to PYME ↔ INVERSOR (`ADMIN` is only obtained through an invitation), and the
 * last active admin can never be deactivated.
 */

export const adminUserRoles = ["PYME", "INVERSOR", "ADMIN"] as const;
export type AdminUserRole = (typeof adminUserRoles)[number];

/** Roles a role-change control may target. `ADMIN` is deliberately absent. */
export const changeableUserRoles = ["PYME", "INVERSOR"] as const;
export type ChangeableUserRole = (typeof changeableUserRoles)[number];

/** A role change is allowed only between PYME and INVERSOR. */
export function isRoleChangeAllowed(from: AdminUserRole, to: AdminUserRole): boolean {
  return (from === "PYME" && to === "INVERSOR") || (from === "INVERSOR" && to === "PYME");
}

/** The roles the control may offer for the given current role (empty for ADMIN). */
export function roleChangeTargets(role: AdminUserRole): ChangeableUserRole[] {
  if (role === "PYME") return ["INVERSOR"];
  if (role === "INVERSOR") return ["PYME"];
  return [];
}

export type DeactivationErrorCode = "already_inactive" | "self" | "last_admin";

export type DeactivationCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: DeactivationErrorCode };

/**
 * Guards a deactivation: an inactive account is a no-op, the admin cannot
 * deactivate themselves, and the last active admin is protected so the console
 * is never left without an operator.
 */
export function canDeactivateUser(input: {
  readonly isSelf: boolean;
  readonly role: AdminUserRole;
  readonly active: boolean;
  readonly activeAdminCount: number;
}): DeactivationCheck {
  if (!input.active) return { ok: false, code: "already_inactive" };
  if (input.isSelf) return { ok: false, code: "self" };
  if (input.role === "ADMIN" && input.activeAdminCount <= 1) {
    return { ok: false, code: "last_admin" };
  }
  return { ok: true };
}

import { isRoleChangeAllowed } from "@vaqcrow/domain";
import type { ChangeableUserRole } from "@vaqcrow/domain";
import type { AuditLogPort } from "../ports/audit-log-port.js";
import type { AdminUserWriterPort } from "../ports/admin-user-writer-port.js";

/**
 * Change a user's role between PYME and INVERSOR (Feature #390, WU3a).
 *
 * `ADMIN` is never a target — it is only obtained through an operator
 * invitation — so an admin target, an unchanged request and a transition the
 * domain rule forbids are all conflicts that write nothing. A successful change
 * writes `profile.role` and appends exactly one audit entry carrying
 * `{ from, to }`, attributed to the verified principal. A failed audit append
 * makes the whole operation `unavailable`.
 */

export interface ChangeUserRoleDependencies {
  readonly users: AdminUserWriterPort;
  readonly audit: AuditLogPort;
}

export interface ChangeUserRoleRequest {
  readonly targetUserId: string;
  /** The requested role; the contract already excludes `ADMIN`. */
  readonly role: ChangeableUserRole;
  /** The verified principal's user id; never a client-supplied value. */
  readonly actorUserId: string;
  readonly correlationId?: string;
}

export type ChangeUserRoleErrorCode =
  | "not_found"
  | "target_is_admin"
  | "unchanged"
  | "role_not_allowed"
  | "unavailable";

export interface ChangeUserRoleValue {
  readonly userId: string;
  readonly role: ChangeableUserRole;
}

export type ChangeUserRoleOutcome =
  | { readonly ok: true; readonly value: ChangeUserRoleValue }
  | { readonly ok: false; readonly error: { readonly code: ChangeUserRoleErrorCode } };

const NOT_FOUND: ChangeUserRoleOutcome = { ok: false, error: { code: "not_found" } };
const UNAVAILABLE: ChangeUserRoleOutcome = { ok: false, error: { code: "unavailable" } };

export async function changeUserRole(
  dependencies: ChangeUserRoleDependencies,
  input: ChangeUserRoleRequest
): Promise<ChangeUserRoleOutcome> {
  try {
    const profile = await dependencies.users.findProfile(input.targetUserId);
    if (!profile.ok) return profile.error.code === "not_found" ? NOT_FOUND : UNAVAILABLE;

    const from = profile.value.role;
    if (from === "ADMIN") return { ok: false, error: { code: "target_is_admin" } };
    if (from === input.role) return { ok: false, error: { code: "unchanged" } };
    if (!isRoleChangeAllowed(from, input.role)) {
      return { ok: false, error: { code: "role_not_allowed" } };
    }

    const written = await dependencies.users.setRole(input.targetUserId, input.role);
    if (!written.ok) return written.error.code === "not_found" ? NOT_FOUND : UNAVAILABLE;

    const audited = await dependencies.audit.append({
      actorUserId: input.actorUserId,
      action: "admin.user_role_changed",
      targetType: "user",
      targetId: input.targetUserId,
      detail: { from, to: input.role },
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId })
    });
    if (!audited.ok) return UNAVAILABLE;

    return { ok: true, value: { userId: input.targetUserId, role: input.role } };
  } catch {
    return UNAVAILABLE;
  }
}

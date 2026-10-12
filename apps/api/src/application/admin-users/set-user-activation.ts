import { canDeactivateUser } from "@vaqcrow/domain";
import type { AuditLogPort } from "../ports/audit-log-port.js";
import type { AdminUserWriterPort } from "../ports/admin-user-writer-port.js";

/**
 * Activate / deactivate a user (Feature #390, WU3a).
 *
 * Only deactivation is guarded: it runs the domain rule `canDeactivateUser`
 * with the real active-admin count and the `isSelf` flag, so an admin cannot
 * deactivate themselves and the last active admin is protected. Activation is a
 * plain idempotent write. On success exactly one append-only audit entry is
 * written, attributed to the verified principal, never to request data; if the
 * audit append fails the operation is reported `unavailable`, because a user
 * management write without its audit record is not a completed operation.
 */

export interface SetUserActivationDependencies {
  readonly users: AdminUserWriterPort;
  readonly audit: AuditLogPort;
}

export interface SetUserActivationRequest {
  readonly targetUserId: string;
  readonly active: boolean;
  /** The verified principal's user id; never a client-supplied value. */
  readonly actorUserId: string;
  readonly correlationId?: string;
}

export type SetUserActivationErrorCode =
  | "not_found"
  | "already_inactive"
  | "self"
  | "last_admin"
  | "unavailable";

export interface SetUserActivationValue {
  readonly userId: string;
  readonly active: boolean;
}

export type SetUserActivationOutcome =
  | { readonly ok: true; readonly value: SetUserActivationValue }
  | { readonly ok: false; readonly error: { readonly code: SetUserActivationErrorCode } };

const NOT_FOUND: SetUserActivationOutcome = { ok: false, error: { code: "not_found" } };
const UNAVAILABLE: SetUserActivationOutcome = { ok: false, error: { code: "unavailable" } };

export async function setUserActivation(
  dependencies: SetUserActivationDependencies,
  input: SetUserActivationRequest
): Promise<SetUserActivationOutcome> {
  try {
    const profile = await dependencies.users.findProfile(input.targetUserId);
    if (!profile.ok) return profile.error.code === "not_found" ? NOT_FOUND : UNAVAILABLE;

    if (!input.active) {
      const activeAdminCount = await dependencies.users.countActiveAdmins();
      if (!activeAdminCount.ok) return UNAVAILABLE;

      const check = canDeactivateUser({
        isSelf: input.targetUserId === input.actorUserId,
        role: profile.value.role,
        active: profile.value.status === "active",
        activeAdminCount: activeAdminCount.value
      });
      if (!check.ok) return { ok: false, error: { code: check.code } };
    }

    const written = await dependencies.users.setActive(input.targetUserId, input.active);
    if (!written.ok) return written.error.code === "not_found" ? NOT_FOUND : UNAVAILABLE;

    const audited = await dependencies.audit.append({
      actorUserId: input.actorUserId,
      action: input.active ? "admin.user_activated" : "admin.user_deactivated",
      targetType: "user",
      targetId: input.targetUserId,
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId })
    });
    if (!audited.ok) return UNAVAILABLE;

    return { ok: true, value: { userId: input.targetUserId, active: input.active } };
  } catch {
    return UNAVAILABLE;
  }
}

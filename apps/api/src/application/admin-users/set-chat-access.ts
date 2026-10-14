import type { AuditLogPort } from "../ports/audit-log-port.js";
import type { AdminChatAccessWriterPort } from "../ports/admin-user-writer-port.js";

/**
 * Toggle a user's assistant access (#499/WU2, owner decision D9).
 *
 * The flag is off by default and the API enforces it; this is the only way to
 * turn it on for a demo. A write that matches no profile row is `not_found`; a
 * successful write appends exactly one audit entry, attributed to the verified
 * principal, and a failed audit append makes the whole operation `unavailable`
 * — an access change without its audit record is not a completed operation.
 */

export interface SetChatAccessDependencies {
  readonly users: AdminChatAccessWriterPort;
  readonly audit: AuditLogPort;
}

export interface SetChatAccessRequest {
  readonly targetUserId: string;
  readonly enabled: boolean;
  /** The verified principal's user id; never a client-supplied value. */
  readonly actorUserId: string;
  readonly correlationId?: string;
}

export type SetChatAccessErrorCode = "not_found" | "unavailable";

export interface SetChatAccessValue {
  readonly userId: string;
  readonly enabled: boolean;
}

export type SetChatAccessOutcome =
  | { readonly ok: true; readonly value: SetChatAccessValue }
  | { readonly ok: false; readonly error: { readonly code: SetChatAccessErrorCode } };

const UNAVAILABLE: SetChatAccessOutcome = { ok: false, error: { code: "unavailable" } };

export async function setChatAccess(
  dependencies: SetChatAccessDependencies,
  input: SetChatAccessRequest
): Promise<SetChatAccessOutcome> {
  try {
    const written = await dependencies.users.setChatAccess(input.targetUserId, input.enabled);
    if (!written.ok) {
      return { ok: false, error: { code: written.error.code === "not_found" ? "not_found" : "unavailable" } };
    }

    const audited = await dependencies.audit.append({
      actorUserId: input.actorUserId,
      action: "admin.chat_access_changed",
      targetType: "user",
      targetId: input.targetUserId,
      detail: { enabled: input.enabled },
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId })
    });
    if (!audited.ok) return UNAVAILABLE;

    return { ok: true, value: { userId: input.targetUserId, enabled: input.enabled } };
  } catch {
    return UNAVAILABLE;
  }
}

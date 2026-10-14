import type {
  AdminUsersMutationResult,
  AdminUsersPageResult,
  AdminUsersPort,
  AuditLogResult,
  InviteOperatorOutcome
} from "@/application/admin/users";

/**
 * Null-object admin › Usuarios port used when no backend base URL is
 * configured: every read is the sanitized `unavailable` and every write is
 * `unavailable`, so the view shows its error state instead of an invented list
 * or a silently-swallowed mutation.
 */
export const UNAVAILABLE_ADMIN_USERS_PORT: AdminUsersPort = Object.freeze({
  async listUsers(): Promise<AdminUsersPageResult> {
    return { ok: false, code: "unavailable" };
  },
  async listAudit(): Promise<AuditLogResult> {
    return { ok: false, code: "unavailable" };
  },
  async setUserActive(): Promise<AdminUsersMutationResult> {
    return { ok: false, code: "unavailable" };
  },
  async changeUserRole(): Promise<AdminUsersMutationResult> {
    return { ok: false, code: "unavailable" };
  },
  async setChatAccess(): Promise<AdminUsersMutationResult> {
    return { ok: false, code: "unavailable" };
  },
  async inviteOperator(): Promise<InviteOperatorOutcome> {
    return { ok: false, code: "unavailable" };
  }
});

import { z } from "zod";

/**
 * Admin › Usuarios (Feature #390): the shapes the admin console reads and
 * writes for user management.
 *
 * The admin is the only role allowed to operate here. `ADMIN` is never
 * self-assigned and is only obtained through an operator invitation, so the
 * role-change command deliberately excludes it (WU1 domain rule).
 */

/** The role vocabulary, shared with the auth feature. */
export const adminUserRoleSchema = z.enum(["PYME", "INVERSOR", "ADMIN"]);
export type AdminUserRole = z.infer<typeof adminUserRoleSchema>;

/** The account status the admin sees: `invited` until the invitation is accepted. */
export const adminUserStatusSchema = z.enum(["active", "inactive", "invited"]);
export type AdminUserStatus = z.infer<typeof adminUserStatusSchema>;

/**
 * The simulated KYC state shown read-only to the admin. The investor's KYC is
 * simulated and auto-approved at the first contribution, so the admin only
 * ever *sees* it; `not_applicable` covers accounts the demo does not verify.
 */
export const adminUserKycStatusSchema = z.enum([
  "not_started",
  "approved_simulated",
  "not_applicable"
]);
export type AdminUserKycStatus = z.infer<typeof adminUserKycStatusSchema>;

export const adminUserSchema = z.strictObject({
  userId: z.uuid(),
  displayName: z.string().min(1),
  email: z.email(),
  role: adminUserRoleSchema,
  status: adminUserStatusSchema,
  lastActivityAt: z.iso.datetime({ offset: true }).nullable(),
  kycStatus: adminUserKycStatusSchema,
  /** True on the signed-in admin's own row: shown as "Tu cuenta", not deactivatable. */
  isSelf: z.boolean(),
  /**
   * The per-user help-assistant access flag (#499, owner decision D9): off by
   * default, granted only by an admin. The admin console reflects the real
   * value; the API enforces it.
   */
  chatEnabled: z.boolean()
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export function parseAdminUser(input: unknown): AdminUser {
  return adminUserSchema.parse(input);
}

/** Search, filters and pagination for the users list (owner decision D4: complete). */
export const adminUsersQuerySchema = z.strictObject({
  search: z.string().trim().min(1).optional(),
  role: adminUserRoleSchema.optional(),
  status: adminUserStatusSchema.optional(),
  page: z.int().min(1),
  pageSize: z.int().min(1).max(100)
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export function parseAdminUsersQuery(input: unknown): AdminUsersQuery {
  return adminUsersQuerySchema.parse(input);
}

export const adminUsersPageSchema = z.strictObject({
  items: z.array(adminUserSchema),
  total: z.int().min(0),
  page: z.int().min(1),
  pageSize: z.int().min(1).max(100)
});
export type AdminUsersPage = z.infer<typeof adminUsersPageSchema>;

export function parseAdminUsersPage(input: unknown): AdminUsersPage {
  return adminUsersPageSchema.parse(input);
}

/** Activate / deactivate. Deactivation takes effect through the auth feature. */
export const setUserActiveCommandSchema = z.strictObject({
  active: z.boolean()
});
export type SetUserActiveCommand = z.infer<typeof setUserActiveCommandSchema>;

export function parseSetUserActiveCommand(input: unknown): SetUserActiveCommand {
  return setUserActiveCommandSchema.parse(input);
}

/** A role change is limited to PYME ↔ INVERSOR; `ADMIN` is never a target here. */
export const changeableUserRoleSchema = z.enum(["PYME", "INVERSOR"]);
export type ChangeableUserRole = z.infer<typeof changeableUserRoleSchema>;

export const changeUserRoleCommandSchema = z.strictObject({
  role: changeableUserRoleSchema
});
export type ChangeUserRoleCommand = z.infer<typeof changeUserRoleCommandSchema>;

export function parseChangeUserRoleCommand(input: unknown): ChangeUserRoleCommand {
  return changeUserRoleCommandSchema.parse(input);
}

/** Invite an operator by email; the invitee sets name + password on acceptance. */
export const inviteOperatorCommandSchema = z.strictObject({
  email: z.email()
});
export type InviteOperatorCommand = z.infer<typeof inviteOperatorCommandSchema>;

export function parseInviteOperatorCommand(input: unknown): InviteOperatorCommand {
  return inviteOperatorCommandSchema.parse(input);
}

export const inviteOperatorResultSchema = z.strictObject({
  userId: z.uuid(),
  email: z.email(),
  status: z.literal("invited")
});
export type InviteOperatorResult = z.infer<typeof inviteOperatorResultSchema>;

export function parseInviteOperatorResult(input: unknown): InviteOperatorResult {
  return inviteOperatorResultSchema.parse(input);
}

/**
 * The invited operator sets their own display name on acceptance. The password
 * is set client-side against Supabase Auth (`updateUser({ password })`), so it
 * never travels through this API command; the profile column caps the name at
 * 120 characters.
 */
export const acceptOperatorInvitationCommandSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(120)
});
export type AcceptOperatorInvitationCommand = z.infer<
  typeof acceptOperatorInvitationCommandSchema
>;

export function parseAcceptOperatorInvitationCommand(
  input: unknown
): AcceptOperatorInvitationCommand {
  return acceptOperatorInvitationCommandSchema.parse(input);
}

/** One append-only audit entry as the admin console renders it. */
export const auditEntryViewSchema = z.strictObject({
  id: z.uuid(),
  occurredAt: z.iso.datetime({ offset: true }),
  actorUserId: z.uuid(),
  actorDisplayName: z.string().min(1),
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  summary: z.string().min(1)
});
export type AuditEntryView = z.infer<typeof auditEntryViewSchema>;

export function parseAuditEntryView(input: unknown): AuditEntryView {
  return auditEntryViewSchema.parse(input);
}

export const auditLogQuerySchema = z.strictObject({
  search: z.string().trim().min(1).optional(),
  page: z.int().min(1),
  pageSize: z.int().min(1).max(100)
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export function parseAuditLogQuery(input: unknown): AuditLogQuery {
  return auditLogQuerySchema.parse(input);
}

export const auditLogPageSchema = z.strictObject({
  items: z.array(auditEntryViewSchema),
  total: z.int().min(0),
  page: z.int().min(1),
  pageSize: z.int().min(1).max(100)
});
export type AuditLogPage = z.infer<typeof auditLogPageSchema>;

export function parseAuditLogPage(input: unknown): AuditLogPage {
  return auditLogPageSchema.parse(input);
}

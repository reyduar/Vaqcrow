import type { AuditLogPort } from "../ports/audit-log-port.js";
import type { OperatorProfileWriterPort } from "../ports/operator-profile-writer-port.js";

/**
 * Accept an operator invitation (Feature #390, WU5).
 *
 * The authenticated invitee sets their own `profile.display_name`; the password
 * is set client-side against Supabase Auth and never crosses this API. The
 * target user id is always the verified principal (`actorUserId`), never a
 * client-supplied value, which is why the route can be `AUTHENTICATED` while
 * every other admin surface is `ADMIN`-only.
 *
 * On success exactly one append-only audit entry
 * (`admin.operator_invitation_accepted`) is written, attributed to the same
 * principal. The audit append is part of the completed operation: if it fails
 * the whole acceptance is reported `unavailable`, the same rule the invitation
 * use case applies.
 */

export interface AcceptOperatorInvitationDependencies {
  readonly profile: OperatorProfileWriterPort;
  readonly audit: AuditLogPort;
}

export interface AcceptOperatorInvitationRequest {
  readonly displayName: string;
  /** The verified principal's user id; never a client-supplied value. */
  readonly actorUserId: string;
  readonly correlationId?: string;
}

export interface AcceptOperatorInvitationResult {
  readonly userId: string;
  readonly displayName: string;
}

export type AcceptOperatorInvitationErrorCode = "not_found" | "unavailable";

export type AcceptOperatorInvitationOutcome =
  | { readonly ok: true; readonly value: AcceptOperatorInvitationResult }
  | { readonly ok: false; readonly error: { readonly code: AcceptOperatorInvitationErrorCode } };

const NOT_FOUND: AcceptOperatorInvitationOutcome = { ok: false, error: { code: "not_found" } };
const UNAVAILABLE: AcceptOperatorInvitationOutcome = { ok: false, error: { code: "unavailable" } };

export async function acceptOperatorInvitation(
  dependencies: AcceptOperatorInvitationDependencies,
  input: AcceptOperatorInvitationRequest
): Promise<AcceptOperatorInvitationOutcome> {
  try {
    const written = await dependencies.profile.setDisplayName(input.actorUserId, input.displayName);
    if (!written.ok) return written.error.code === "not_found" ? NOT_FOUND : UNAVAILABLE;

    const audited = await dependencies.audit.append({
      actorUserId: input.actorUserId,
      action: "admin.operator_invitation_accepted",
      targetType: "user",
      targetId: input.actorUserId,
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId })
    });
    if (!audited.ok) return UNAVAILABLE;

    return { ok: true, value: { userId: input.actorUserId, displayName: input.displayName } };
  } catch {
    return UNAVAILABLE;
  }
}

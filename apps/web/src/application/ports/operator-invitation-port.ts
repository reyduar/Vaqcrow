import type { AcceptOperatorInvitationCommand } from "@vaqcrow/contracts";

/**
 * The invitation-acceptance API capability (#390/WU5). Vendor-free and
 * React-free; the HTTP adapter lives in `infrastructure/admin/`, mirroring the
 * other admin gateways.
 *
 * The command carries only the display name: the password is set client-side
 * against Supabase Auth (`updateUser`) and never crosses this boundary. The
 * authenticated caller is identified by their bearer token, so the port takes
 * no user id — the API always edits the caller's own profile row.
 */

/** Sanitized failure codes; the API's envelope `message` never crosses this boundary. */
export type OperatorInvitationErrorCode =
  | "unauthenticated"
  | "invalid_request"
  | "not_found"
  | "unavailable"
  | "network";

export type OperatorInvitationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: OperatorInvitationErrorCode };

export interface OperatorInvitationPort {
  /** Sets the signed-in invitee's display name. Never rejects. */
  accept(command: AcceptOperatorInvitationCommand): Promise<OperatorInvitationResult>;
}

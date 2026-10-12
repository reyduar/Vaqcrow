import type { AuthErrorCode } from "./auth-session-port";

/**
 * The client-side credential capability of the invitation acceptance
 * (#390/WU5). The invited operator sets their own password directly against
 * Supabase Auth (`updateUser({ password })`), so — by owner decision — the
 * password never travels through the Vaqcrow API.
 *
 * Vendor-free and React-free; the Supabase adapter lives in
 * `infrastructure/auth/`. `AuthErrorCode` is reused so the screen has one
 * sanitized vocabulary for provider failures.
 */

export type InvitationCredentialResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: AuthErrorCode };

export interface InvitationCredentialPort {
  /**
   * Sets the password on the signed-in invitee's own account. Resolves with a
   * sanitized result; never rejects.
   */
  setPassword(password: string): Promise<InvitationCredentialResult>;
}

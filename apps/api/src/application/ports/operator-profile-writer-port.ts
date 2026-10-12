/**
 * The operator profile writer (Feature #390, WU5).
 *
 * The invitation acceptance has the authenticated invitee set their own
 * `profile.display_name`. This port is the vendor-free seam that use case
 * depends on; the target user id always comes from the verified principal, so
 * the port stays identity-agnostic and the route decides who may call it.
 *
 * It is deliberately separate from `AdminUserWriterPort`: the acceptance route
 * is `AUTHENTICATED`, not an admin surface, and a dedicated port keeps the
 * ADMIN-only writer's contract from widening.
 *
 * A missing profile is `not_found`; the Supabase adapter sanitizes every
 * provider failure to `unavailable` and never lets its `message`/`details`/
 * `hint` escape. Plain data only: this port lives in `application/` and must
 * not import Fastify, Supabase, Stellar or LLM SDKs.
 */

export type OperatorProfileWriterErrorCode = "not_found" | "unavailable";

export type OperatorProfileWriterResult =
  | { readonly ok: true; readonly value: void }
  | { readonly ok: false; readonly error: { readonly code: OperatorProfileWriterErrorCode } };

export interface OperatorProfileWriterPort {
  /** Sets `display_name` for the target; `not_found` when the row does not exist. */
  setDisplayName(userId: string, displayName: string): Promise<OperatorProfileWriterResult>;
}

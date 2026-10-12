/**
 * The operator-invitation provider (Feature #390, WU3b).
 *
 * `ADMIN` is never self-assigned and is reachable only through an invitation
 * (owner decision Dfn). This port is the vendor-free seam the invitation use
 * case depends on; the Supabase Auth Admin implementation lives in
 * `infrastructure/adapters/supabase-operator-inviter.ts` and is the only place
 * that knows `inviteUserByEmail` / `updateUserById`.
 *
 * The result is sanitized: a provider error never leaks its `message`,
 * `details` or `hint` — only the closed `code`. A thrown adapter must be mapped
 * to `unavailable`, never allowed to surface as a 500.
 *
 * Plain data only: this port lives in `application/` and must not import
 * Fastify, Supabase, Stellar or LLM SDKs.
 */

export interface OperatorInviteRequest {
  readonly email: string;
}

export type OperatorInviterErrorCode = "email_exists" | "unavailable";

export type OperatorInviterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: OperatorInviterErrorCode } };

export interface OperatorInviterPort {
  /**
   * Creates the invited account and promotes it to an active `ADMIN`.
   * `email_exists` when the address already has an account; `unavailable` for
   * every other provider failure (including a promotion that could not apply).
   */
  invite(request: OperatorInviteRequest): Promise<OperatorInviterResult<{ readonly userId: string }>>;
}

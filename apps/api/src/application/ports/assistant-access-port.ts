/**
 * The assistant access and usage port (#499/WU2, owner decisions D5/D6/D9).
 *
 * Three concerns, all scoped to one user:
 *
 * - the per-user `chat_enabled` flag (D9), off by default and toggled from the
 *   admin console;
 * - the count of questions asked inside the rolling window (D6, 5 per 24h);
 * - recording one question timestamp (D5 — timestamps only; the question and
 *   the answer text are never stored).
 *
 * The API connects as `service_role`; the Supabase adapter sanitizes every
 * provider failure to `unavailable`. Plain data only: this port lives in
 * `application/` and imports no SDK.
 */
export type AssistantAccessResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export interface AssistantAccessPort {
  /** The per-user flag; `false` when the profile row carries no flag. */
  isChatEnabled(userId: string): Promise<AssistantAccessResult<boolean>>;

  /** How many questions this user asked at or after `since` (the window start). */
  countRecentQuestions(userId: string, since: Date): Promise<AssistantAccessResult<number>>;

  /** Appends one timestamp for this user. The question text is never stored. */
  recordQuestion(userId: string, askedAt: Date): Promise<AssistantAccessResult<void>>;
}

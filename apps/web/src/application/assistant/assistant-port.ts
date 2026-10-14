import type { AssistantAnswer } from "@vaqcrow/contracts";

/**
 * The help-assistant capability (#499, WU3). Vendor-free and React-free: the
 * HTTP adapter lives in `infrastructure/assistant/`.
 *
 * It mirrors `POST /assistant/questions` — one untrusted question in, one
 * `{ answer, citations[] }` out. The answer already carries the fixed D8 copy
 * (the out-of-scope decline, the no-documentation answer, the account pointer
 * and the cap suggestion) as a normal 200, so the web never retypes those
 * strings; it renders whatever the API returned.
 *
 * The wire shapes are reused from `@vaqcrow/contracts` rather than re-declared,
 * so the port cannot drift from the API.
 */
export type { AssistantAnswer, AssistantCitation } from "@vaqcrow/contracts";

/**
 * Sanitized failure codes: the API's own `forbidden` (the per-user flag is off,
 * D9) and `unavailable` (a provider failure), the transport's `network`, and the
 * local `not_configured` emitted only by the null-object port when no API base
 * URL is configured. `not_configured` is never a server code and must never be
 * treated as a service failure.
 */
export type AssistantErrorCode = "forbidden" | "unavailable" | "network" | "not_configured";

export type AssistantAskResult =
  | { readonly ok: true; readonly answer: AssistantAnswer }
  | { readonly ok: false; readonly code: AssistantErrorCode };

export interface AssistantPort {
  /** One single-turn question (owner decision D4: no history). */
  ask(question: string): Promise<AssistantAskResult>;
}

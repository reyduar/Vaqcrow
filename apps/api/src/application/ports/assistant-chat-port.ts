/**
 * The assistant's LLM transport (#499/WU2).
 *
 * The application layer knows only "messages in, one text out"; the OpenCode Go
 * dialect, the headers and the timeout live in the infrastructure adapter. Two
 * instances of this port are wired — one per configured model (router and
 * answer) — so both share a single code path.
 *
 * The failure vocabulary is closed and intentional. `invalid_output` is the
 * adapter's way of saying "the answer is not usable" — a null `content` (a
 * reasoning model that exhausted its `max_tokens`) or a `finish_reason` of
 * `length`. The caller retries that once and then answers "no documentation";
 * a `timeout` or `unavailable` is a provider failure and becomes a `503`.
 */
export type AssistantChatMessage =
  | { readonly role: "system"; readonly content: string }
  | { readonly role: "user"; readonly content: string };

export type AssistantChatErrorCode = "unavailable" | "timeout" | "invalid_output";

export type AssistantChatResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: { readonly code: AssistantChatErrorCode } };

export interface AssistantChatPort {
  complete(messages: readonly AssistantChatMessage[]): Promise<AssistantChatResult>;
}

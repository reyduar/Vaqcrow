import type { AssistantAskResult, AssistantPort } from "@/application/assistant/assistant-port";

/**
 * Null-object assistant port used when no backend base URL is configured: the
 * ask answers `not_configured` — the honest "no API wired up", which the chat
 * renders as a calm notice, **not** as a service failure and never as an
 * invented answer.
 */
export const UNAVAILABLE_ASSISTANT_PORT: AssistantPort = Object.freeze({
  async ask(): Promise<AssistantAskResult> {
    return { ok: false, code: "not_configured" };
  }
});

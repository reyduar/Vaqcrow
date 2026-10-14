import type {
  AssistantChatMessage,
  AssistantChatPort,
  AssistantChatResult
} from "../../application/ports/assistant-chat-port.js";

/**
 * The OpenCode Go assistant transport (#499/WU2).
 *
 * It speaks the same OpenAI-compatible `/v1/chat/completions` dialect the
 * assessment and vision adapters use — same base, same bearer auth, the
 * mandatory `x-opencode-session` header and a client-specific user agent — and
 * it mirrors their `readMessageContent`/`isTimeout` readers (they are not
 * exported from `@vaqcrow/ai`, and this unit's surfaces do not include that
 * package's entry point, so the two small readers are reproduced here).
 *
 * The models are reasoners: `reasoning_content` may carry the thinking while
 * `content` is `null` after the reasoning exhausted `max_tokens` (a
 * `finish_reason` of `length`). Both are a defined `invalid_output` — the caller
 * retries once — never an empty answer. `response_format` is deliberately not
 * sent: it is accepted but does not help (the spike, 2026-10-14).
 */

export type OpenCodeGoAssistantChatOptions = {
  /** The provider's base, without a trailing slash, e.g. `https://opencode.ai/zen/go/v1`. */
  readonly baseUrl: string;
  readonly model: string;
  /**
   * The credential, revealed at the point of use by the caller. A plain string
   * because this adapter cannot know the application's `Secret` type.
   */
  readonly apiKey: string;
  readonly timeoutMs: number;
  /** Generous on purpose: a reasoning model may spend most of it before answering. */
  readonly maxTokens?: number;
  /**
   * A stable id per call path. The provider rejects requests without it
   * (`400 MissingSessionID`), so it is not optional in practice.
   */
  readonly sessionId?: string;
  /** Injected transport, so pull-request checks never reach a live provider. */
  readonly fetchImpl?: typeof fetch;
};

const CLIENT_USER_AGENT = "vaqcrow-assistant/1.0";
const DEFAULT_MAX_TOKENS = 2000;

export function createOpenCodeGoAssistantChat(
  options: OpenCodeGoAssistantChatOptions
): AssistantChatPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sessionId = options.sessionId ?? `vaqcrow-assistant-${Math.random().toString(36).slice(2, 10)}`;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  return {
    async complete(messages: readonly AssistantChatMessage[]): Promise<AssistantChatResult> {
      let response: Response;

      try {
        response = await fetchImpl(`${options.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${options.apiKey}`,
            "user-agent": CLIENT_USER_AGENT,
            "x-opencode-session": sessionId
          },
          body: JSON.stringify({
            model: options.model,
            messages,
            // Determinism first: this is a lookup, not a creative task.
            temperature: 0,
            max_tokens: maxTokens
          }),
          signal: AbortSignal.timeout(options.timeoutMs)
        });
      } catch (error) {
        return { ok: false, error: { code: isTimeout(error) ? "timeout" : "unavailable" } };
      }

      if (!response.ok) {
        return { ok: false, error: { code: "unavailable" } };
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return { ok: false, error: { code: "unavailable" } };
      }

      const content = readMessageContent(payload);
      // A null content or a length-limited finish is a failure, not an empty answer.
      if (typeof content !== "string" || content.trim() === "" || readFinishReason(payload) === "length") {
        return { ok: false, error: { code: "invalid_output" } };
      }

      return { ok: true, value: content };
    }
  };
}

/** Reads `choices[0].message.content`, or `undefined` if the shape is not there. */
function readMessageContent(payload: unknown): string | undefined {
  return readChoice(payload)?.content;
}

/** Reads `choices[0].finish_reason`, or `undefined`. */
function readFinishReason(payload: unknown): string | undefined {
  return readChoice(payload)?.finishReason;
}

function readChoice(payload: unknown): { readonly content: string | undefined; readonly finishReason: string | undefined } | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;

  const choice = choices[0] as { message?: unknown; finish_reason?: unknown };
  const message = choice.message;
  const content =
    typeof message === "object" && message !== null && typeof (message as { content?: unknown }).content === "string"
      ? ((message as { content: string }).content)
      : undefined;
  const finishReason = typeof choice.finish_reason === "string" ? choice.finish_reason : undefined;

  return { content, finishReason };
}

function isTimeout(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

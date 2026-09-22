import { ASSESSMENT_PROMPT_VERSION, buildAssessmentMessages } from "./assessment-prompt.js";
import type { AssessmentProviderOutcome, AssessmentProviderPort } from "./assessment-provider-port.js";

/**
 * The production provider adapter: the one thing in this repository that talks
 * to a real model.
 *
 * It speaks exactly one dialect — the provider's OpenAI-compatible
 * `/v1/chat/completions`. The provider also serves some models on an
 * Anthropic-native `/v1/messages` endpoint; modelling both would double this
 * code for no demo benefit, so the selected models must come from the
 * chat-completions group.
 *
 * Its job is narrow on purpose. It sends the request, and it hands back the
 * model's answer as **untrusted raw output** plus its provenance. It does not
 * validate the assessment — that belongs on the caller's side of the port — and
 * it invents no error vocabulary: the four codes it can produce are the ones the
 * port already declares.
 */

export type OpenCodeGoProviderOptions = {
  /** The provider's base, without a trailing slash, e.g. `https://opencode.ai/zen/go/v1`. */
  readonly baseUrl: string;
  readonly model: string;
  /**
   * The credential, revealed at the point of use by the caller. A plain string
   * because this package cannot know the application's `Secret` type; the
   * application unwraps it here and nowhere else.
   */
  readonly apiKey: string;
  readonly timeoutMs: number;
  /**
   * A stable id per conversation. The provider's documentation asks for it and
   * rejects requests without it (`400 MissingSessionID`), so it is not optional
   * in practice even though a caller could omit it and get a generated one.
   */
  readonly sessionId?: string;
  /** Injected transport, so pull-request checks never reach a live provider. */
  readonly fetchImpl?: typeof fetch;
  /** Injectable clock, so the retained metadata is deterministic in tests. */
  readonly now?: () => string;
};

/**
 * Identifies this client rather than arriving as a generic HTTP library. The
 * provider asks for it explicitly and monitors traffic.
 */
const CLIENT_USER_AGENT = "vaqcrow-assessment/1.0";

export function createOpenCodeGoProvider(
  options: OpenCodeGoProviderOptions
): AssessmentProviderPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? ((): string => new Date().toISOString());
  const sessionId = options.sessionId ?? `vaqcrow-${Math.random().toString(36).slice(2, 10)}`;

  return {
    async assess({ evidence }): Promise<AssessmentProviderOutcome> {
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
            messages: buildAssessmentMessages(evidence),
            // Determinism first: this is an assessment, not a creative task.
            temperature: 0
          }),
          signal: AbortSignal.timeout(options.timeoutMs)
        });
      } catch (error) {
        return { ok: false, error: { code: isTimeout(error) ? "timeout" : "provider_unavailable" } };
      }

      if (!response.ok) {
        // The provider's own status and message never cross this boundary; the
        // caller gets a sanitized code, exactly as the Stellar adapter does
        // with Horizon's result codes.
        return { ok: false, error: { code: "provider_unavailable" } };
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return { ok: false, error: { code: "provider_unavailable" } };
      }

      return {
        ok: true,
        // An empty or absent content is returned as-is, deliberately: reasoning
        // models can leave `content` empty while `reasoning_content` carries
        // their thinking, and the contract must reject that as invalid output
        // rather than let it pass as an assessment.
        rawOutput: readMessageContent(payload) ?? "",
        metadata: {
          model: options.model,
          promptVersion: ASSESSMENT_PROMPT_VERSION,
          generatedAt: now(),
          source: "provider"
        }
      };
    }
  };
}

/** Reads `choices[0].message.content`, or `undefined` if the shape is not there. */
function readMessageContent(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return undefined;
  }

  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    return undefined;
  }

  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : undefined;
}

function isTimeout(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

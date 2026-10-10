import { isTimeout, readMessageContent } from "./opencode-go-provider.js";
import type { VisionOutcome, VisionProviderPort } from "./vision-provider-port.js";
import { VISION_PROMPT_VERSION, VISION_SYSTEM_PROMPT, buildVisionQuestion } from "./vision-prompt.js";
import { visionRelevanceSchema } from "./vision-relevance.js";
import type { VisionRelevance } from "./vision-relevance.js";

/**
 * The production vision adapter: the one place that talks to a real vision
 * model, separately from the assessment engine.
 *
 * It speaks the same OpenAI-compatible `/v1/chat/completions` dialect as
 * `opencode-go-provider.ts` — same base URL, same mandatory `x-opencode-session`
 * header, same bearer auth, same injected transport and same sanitized error
 * mapping — but sends a multimodal content array instead of a text message:
 *
 *   [{ type: "text", text }, { type: "image_url", image_url: { url: dataUrl } }]
 *
 * The provider answers with text containing the JSON verdict, which this
 * adapter parses and validates against `visionRelevanceSchema`. Unlike the
 * assessment adapter (which hands raw output to a separate contract), here the
 * port's value *is* the validated verdict, so a malformed answer is the
 * adapter's `invalid_output` and the model's raw text never crosses the
 * boundary.
 *
 * Images only: a PDF is rejected by the provider's image validator, so the
 * caller rasterizes it first (U4). This adapter accepts whatever content type
 * it is given and embeds it in the data URL.
 */

export type OpenCodeGoVisionProviderOptions = {
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
   * A stable id per conversation. The provider rejects requests without it
   * (`400 MissingSessionID`), so it is not optional in practice even though a
   * caller could omit it and get a generated one.
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
const CLIENT_USER_AGENT = "vaqcrow-vision/1.0";

export function createOpenCodeGoVisionProvider(
  options: OpenCodeGoVisionProviderOptions
): VisionProviderPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? ((): string => new Date().toISOString());
  const sessionId = options.sessionId ?? `vaqcrow-${Math.random().toString(36).slice(2, 10)}`;

  return {
    async assessRelevance({ kind, contentType, imageBase64 }): Promise<VisionOutcome> {
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
            messages: [
              { role: "system", content: VISION_SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "text", text: buildVisionQuestion(kind) },
                  { type: "image_url", image_url: { url: `data:${contentType};base64,${imageBase64}` } }
                ]
              }
            ],
            // Determinism first: this is a classification, not a creative task.
            temperature: 0
          }),
          signal: AbortSignal.timeout(options.timeoutMs)
        });
      } catch (error) {
        return { ok: false, error: { code: isTimeout(error) ? "timeout" : "provider_unavailable" } };
      }

      if (!response.ok) {
        // The provider's own status and message never cross this boundary.
        return { ok: false, error: { code: "provider_unavailable" } };
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return { ok: false, error: { code: "provider_unavailable" } };
      }

      const value = normalizeRelevance(readMessageContent(payload));

      if (value === undefined) {
        return { ok: false, error: { code: "invalid_output" } };
      }

      return {
        ok: true,
        value,
        metadata: {
          model: options.model,
          promptVersion: VISION_PROMPT_VERSION,
          generatedAt: now(),
          source: "provider"
        }
      };
    }
  };
}

/**
 * Parses the model's text into a validated verdict.
 *
 * Markdown fences are deliberately **not** stripped: the prompt asks for one
 * JSON object and nothing else, and forgiving a fence here would hide a prompt
 * or model regression behind leniency. Any malformed answer returns `undefined`
 * so the caller maps it to `invalid_output` and the raw text is never surfaced.
 */
function normalizeRelevance(content: string | undefined): VisionRelevance | undefined {
  if (typeof content !== "string") {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return undefined;
  }

  const result = visionRelevanceSchema.safeParse(parsed);
  return result.success ? result.data : undefined;
}

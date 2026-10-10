import { z } from "zod";

/**
 * The relevance verdict contract (Feature #402, U3).
 *
 * This module owns the *shape* of a vision model's answer and nothing else: no
 * provider, no network, no document kind. The prompt asks a yes/no question
 * about one image; the model answers with this object, and a malformed answer
 * is rejected as `invalid_output` rather than partially trusted.
 *
 * `strictObject` is the guardrail: an answer carrying an extra field — an
 * instruction channel, a tool call, a score the prompt never requested — is
 * rejected outright, so free text can never smuggle a request through.
 */

export const visionRelevanceSchema = z.strictObject({
  relevant: z.boolean(),
  /**
   * A short Spanish explanation (es-AR). Bounded and trimmed so a model cannot
   * turn the verdict into a paragraph of untrusted copy the UI would render.
   */
  reason: z.string().trim().min(1).max(300)
});

export type VisionRelevance = z.infer<typeof visionRelevanceSchema>;

/** Validates a parsed model answer, or throws. Prefer `safeParse` at the boundary. */
export function parseVisionRelevance(input: unknown): VisionRelevance {
  return visionRelevanceSchema.parse(input);
}

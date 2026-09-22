import type {
  AssessmentProviderOutcome,
  AssessmentProviderPort
} from "./assessment-provider-port.js";

/**
 * The provider implementation the demo runs on until the real one is chosen.
 *
 * It is NOT a model and it is not pretending to be: it replays a fixed output
 * and marks its metadata `source: "simulated"`, so nothing downstream can show
 * it as a real evaluation. `DEMO.md` leaves the real provider `TBD`, and the
 * acceptance criteria of Feature #21 are about the boundary being replaceable,
 * not about which vendor sits behind it — so this is what makes the path
 * executable today without inventing a provider decision.
 */

export type SimulatedAssessmentProviderOptions = {
  /** The raw output to replay, exactly as a provider would return it. */
  readonly output: unknown;
  readonly model?: string;
  readonly promptVersion?: string;
  /** Injectable clock, so metadata is deterministic in tests. */
  readonly now?: () => string;
  /** Simulated latency in milliseconds. */
  readonly delayMs?: number;
  /** Simulate a provider-side failure instead of answering. */
  readonly failWith?: "timeout" | "provider_unavailable";
};

const DEFAULT_MODEL = "simulated-underwriter";
const DEFAULT_PROMPT_VERSION = "prompt-v1";

export function createSimulatedAssessmentProvider(
  options: SimulatedAssessmentProviderOptions
): AssessmentProviderPort {
  const model = options.model ?? DEFAULT_MODEL;
  const promptVersion = options.promptVersion ?? DEFAULT_PROMPT_VERSION;
  const now = options.now ?? ((): string => new Date().toISOString());

  return {
    async assess(): Promise<AssessmentProviderOutcome> {
      if (options.delayMs !== undefined && options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }

      if (options.failWith !== undefined) {
        return { ok: false, error: { code: options.failWith } };
      }

      return {
        ok: true,
        rawOutput: options.output,
        metadata: { model, promptVersion, generatedAt: now(), source: "simulated" }
      };
    }
  };
}

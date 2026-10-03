import { AI_SIMULATED_CHECKS } from "@/application/pyme-onboarding/ai-step";
import type {
  AiEvaluationInput,
  AiEvaluationPort,
  AiEvaluationResult
} from "@/application/ports/ai-evaluation-port";

/** The template's ~2200 ms analysis pause. */
const DEFAULT_DELAY_MS = 2200;

/**
 * Deterministic simulated AI evaluation (Feature #398, Task #399 / T5).
 *
 * There is no vendor call and no network: it waits the template's delay and
 * returns the same medium band and the same four checks every time. The delay
 * is injectable so tests resolve instantly; Feature #402 replaces this adapter
 * with the real completeness check behind the same port, without the
 * presentation layer changing.
 */
export class SimulatedAiEvaluationAdapter implements AiEvaluationPort {
  constructor(private readonly delayMs: number = DEFAULT_DELAY_MS) {}

  // The simulated result is fixed; the input is part of the port contract and
  // is consumed by the real completeness check behind it (#402).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see above
  async evaluate(_input: AiEvaluationInput): Promise<AiEvaluationResult> {
    await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
    return { riskBand: "medium", checks: AI_SIMULATED_CHECKS };
  }
}

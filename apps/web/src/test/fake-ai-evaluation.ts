/**
 * Test-only in-memory `AiEvaluationPort`. No network, no timers.
 *
 * It mirrors the simulated adapter's observable contract (a deterministic
 * medium band with the four template checks) and adds test controls the real
 * adapter does not have — `seedResult`, `failNext` and a held promise
 * (`holdNextEvaluate`) so the busy state is observable without fake timers.
 *
 * Not collected as a test suite: it has no `.test.` segment.
 */
import { AI_SIMULATED_CHECKS } from "@/application/pyme-onboarding/ai-step";
import type {
  AiEvaluationInput,
  AiEvaluationPort,
  AiEvaluationResult
} from "@/application/ports/ai-evaluation-port";

export class FakeAiEvaluation implements AiEvaluationPort {
  /** Evaluation requests received, in order. */
  readonly calls: AiEvaluationInput[] = [];
  private result: AiEvaluationResult = { riskBand: "medium", checks: AI_SIMULATED_CHECKS };
  private failures = 0;
  private held: Promise<void> | null = null;

  seedResult(result: AiEvaluationResult): void {
    this.result = result;
  }

  /** The next `evaluate` call rejects. */
  failNext(): void {
    this.failures += 1;
  }

  /** Holds the next resolution until the returned release is called. */
  holdNextEvaluate(): () => void {
    let release!: () => void;
    this.held = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  }

  async evaluate(input: AiEvaluationInput): Promise<AiEvaluationResult> {
    this.calls.push(input);
    const held = this.held;
    this.held = null;
    if (held) await held;
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error("ai evaluation failed");
    }
    return this.result;
  }
}

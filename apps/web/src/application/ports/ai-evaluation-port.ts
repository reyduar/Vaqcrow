/**
 * AI evaluation capability of the PyME onboarding wizard's step 3
 * («Evaluación AI», Feature #398, Task #399 / T5). Vendor-free and React-free:
 * the simulated adapter lives in `infrastructure/ai-evaluation/` and Feature
 * #402 swaps in the real completeness check behind this same port.
 *
 * The AI is advisory: it organises the evidence, marks missing data and
 * anomalies and proposes a risk band. It never approves, rejects, calculates
 * an obligation or moves funds — the human review in step 4 decides.
 */

/** Proposed risk band; a label, never a decision. */
export type AiRiskBand = "low" | "medium" | "high";

/** A check is either satisfied (`ok`) or needs attention (`warning`). */
export type AiCheckKind = "ok" | "warning";

export interface AiEvaluationCheck {
  readonly kind: AiCheckKind;
  readonly title: string;
  readonly body: string;
}

export interface AiEvaluationResult {
  readonly riskBand: AiRiskBand;
  readonly checks: readonly AiEvaluationCheck[];
}

/**
 * What the evaluation receives. Kept to the evidence the wizard already has;
 * the real completeness check (#402) extends this additively when it lands.
 */
export interface AiEvaluationInput {
  /** The PyME reference the request will be sent under (CUIT digits). */
  readonly smeReference: string;
  /** Raw monthly sales figures, exactly as typed (empty string = missing). */
  readonly sales: readonly string[];
}

export interface AiEvaluationPort {
  evaluate(input: AiEvaluationInput): Promise<AiEvaluationResult>;
}

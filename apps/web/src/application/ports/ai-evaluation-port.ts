/**
 * AI evaluation capability of the PyME onboarding wizard's step 3
 * («Evaluación AI», Feature #398, Task #399 / T5). Vendor-free and React-free:
 * the simulated adapter lives in `infrastructure/ai-evaluation/`.
 *
 * The AI is advisory: it proposes a risk band. It never approves, rejects,
 * calculates an obligation or moves funds — the human review in step 4 decides.
 *
 * Feature #402 split the concerns: the **completeness** findings (faltantes and
 * anomalías) are now real and come from the API behind
 * `CompletenessCheckPort`; this port only carries the proposed band, which the
 * simulated adapter still provides. The four mock checks the template drew were
 * removed with the swap so the step never shows a fabricated gap.
 */

/** Proposed risk band; a label, never a decision. */
export type AiRiskBand = "low" | "medium" | "high";

export interface AiEvaluationResult {
  readonly riskBand: AiRiskBand;
}

/**
 * What the evaluation receives. Kept to the evidence the wizard already has.
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

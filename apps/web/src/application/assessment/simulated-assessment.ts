/**
 * Frozen SIMULATED assessment fixture for the assessment screen (Issue #62 T6).
 *
 * This is NOT an LLM output: the real, schema-validated AI evaluation belongs
 * to Feature #20. The fixture mirrors the documented output shape (risk band,
 * confidence, cited reasons, uncertainty, pending questions) so the human
 * decision UI can be built and tested without a provider. It is advisory only:
 * it never approves, never proposes a limit, and never moves funds.
 */
export type AssessmentRiskBand = "low" | "medium" | "high";
export type AssessmentRecommendation = "human_review";

export interface AssessmentReason {
  readonly id: string;
  readonly text: string;
  /** Must match `evidenceRef` values of the synthetic sales series. */
  readonly evidenceRefs: readonly string[];
}

export interface SimulatedAssessment {
  readonly assessmentId: string;
  readonly source: "fixture";
  readonly simuladoLabel: "SIMULADO";
  readonly riskBand: AssessmentRiskBand;
  readonly confidencePercent: number;
  readonly recommendation: AssessmentRecommendation;
  readonly reasons: readonly AssessmentReason[];
  readonly uncertainty: readonly string[];
  readonly pendingQuestions: readonly string[];
  readonly generatedBy: string;
}

export const simulatedAssessment: SimulatedAssessment = Object.freeze({
  assessmentId: "asm_demo_001",
  source: "fixture",
  simuladoLabel: "SIMULADO",
  riskBand: "medium",
  confidencePercent: 72,
  recommendation: "human_review",
  reasons: Object.freeze([
    Object.freeze({
      id: "reason-missing-april",
      text: "Abril 2026 no tiene ventas declaradas. Se trata como período faltante, no como ventas en cero.",
      evidenceRefs: Object.freeze(["missing:2026-04"])
    }),
    Object.freeze({
      id: "reason-june-anomaly",
      text: "Junio 2026 se aparta de la tendencia de los meses vecinos. No hay datos que expliquen el motivo.",
      evidenceRefs: Object.freeze(["sales:2026-06"])
    }),
    Object.freeze({
      id: "reason-trend",
      text: "Los meses declarados restantes muestran una serie consistente entre sí.",
      evidenceRefs: Object.freeze(["sales:2026-05", "sales:2026-07", "sales:2026-08"])
    })
  ]),
  uncertainty: Object.freeze([
    "Con un período faltante y una anomalía sin explicación, la evaluación de ingresos tiene incertidumbre real.",
    "La serie es sintética y no está verificada contra fuentes externas."
  ]),
  pendingQuestions: Object.freeze([
    "¿Hay documentación que respalde las ventas de abril y explique el valor de junio?"
  ]),
  generatedBy: "Fixture estático de la demo (sin llamada a un modelo)"
});

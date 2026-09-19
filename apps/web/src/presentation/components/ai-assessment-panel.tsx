import type {
  AssessmentRecommendation,
  AssessmentRiskBand,
  SimulatedAssessment
} from "@/application/assessment/simulated-assessment";
import { Badge, type BadgeTone } from "./badge";

/**
 * AiAssessmentPanel (Issue #62 T6): read-only, advisory presentation of the
 * assessment. It renders no control that could decide anything; the human
 * decision lives in a separate block (`HumanDecisionForm`). Risk band and
 * confidence are deliberately separate concepts.
 */
export interface AiAssessmentPanelProps {
  readonly assessment: SimulatedAssessment;
}

const RISK_LABEL: Readonly<Record<AssessmentRiskBand, string>> = {
  low: "Riesgo bajo",
  medium: "Riesgo medio",
  high: "Riesgo alto"
};

const RISK_TONE: Readonly<Record<AssessmentRiskBand, BadgeTone>> = {
  low: "neutral",
  medium: "caution",
  high: "critical"
};

export const RECOMMENDATION_LABEL: Readonly<Record<AssessmentRecommendation, string>> = {
  human_review: "Revisión humana"
};

export const riskLabel = (band: AssessmentRiskBand): string => RISK_LABEL[band];

function TextList({ label, items }: { readonly label: string; readonly items: readonly string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="font-medium">{label}</h4>
      <ul aria-label={label} className="list-disc pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AiAssessmentPanel({ assessment }: AiAssessmentPanelProps) {
  return (
    <section aria-label="Evaluación de IA (simulada)" lang="es" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">Evaluación de IA</h3>
        <Badge variant="simulado" label={assessment.simuladoLabel} lang="es" />
        <span className="text-sm text-muted">ID {assessment.assessmentId}</span>
      </header>

      <p className="text-sm">
        La IA solo asesora: no aprueba, no define límites y no transfiere fondos. Esta evaluación es un fixture de la
        demo; no corresponde a una llamada en vivo.
      </p>

      <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2">
        <dt>Banda de riesgo</dt>
        <dd>
          <Badge
            variant="risk"
            label={RISK_LABEL[assessment.riskBand]}
            tone={RISK_TONE[assessment.riskBand]}
            lang="es"
          />
        </dd>
        <dt>Confianza del modelo</dt>
        <dd>{`${assessment.confidencePercent} %`}</dd>
        <dt>Recomendación</dt>
        <dd>{RECOMMENDATION_LABEL[assessment.recommendation]}</dd>
      </dl>

      <div className="flex flex-col gap-1">
        <h4 className="font-medium">Razones</h4>
        <ul aria-label="Razones" className="flex flex-col gap-3">
          {assessment.reasons.map((reason) => (
            <li key={reason.id} className="flex flex-col gap-1">
              <span>{reason.text}</span>
              <span className="flex flex-wrap items-center gap-1 text-sm text-muted">
                Evidencia:
                {reason.evidenceRefs.map((ref) => (
                  <code key={ref}>{ref}</code>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <TextList label="Incertidumbre" items={assessment.uncertainty} />
      <TextList label="Preguntas pendientes" items={assessment.pendingQuestions} />

      <p className="text-sm text-muted">Origen: {assessment.generatedBy}.</p>
    </section>
  );
}

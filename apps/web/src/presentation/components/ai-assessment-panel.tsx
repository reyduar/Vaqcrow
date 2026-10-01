import type {
  AssessmentRiskBand,
  AssessmentView
} from "@/application/assessment/assessment-view";
import { Badge, type BadgeTone } from "./badge";

/**
 * AiAssessmentPanel: read-only, advisory presentation of an assessment.
 *
 * It renders no control that could decide anything; the human decision lives in
 * a separate block (`HumanDecisionForm`). Risk band and confidence are
 * deliberately separate concepts.
 *
 * It now renders a **real** assessment (`AssessmentView`) rather than the frozen
 * fixture the screen used before the path existed. What it shows is what the
 * backend returned: the reasons with their cited evidence, the anomalies, the
 * declared gaps, the pending questions, and the provenance `DEMO.md` §5
 * requires — which model and which prompt produced this.
 *
 * `provenance.source` is never hidden. A simulated evaluation keeps its badge;
 * a real one names its model. Presenting one as the other is the failure this
 * panel exists to avoid.
 */
export interface AiAssessmentPanelProps {
  readonly assessment: AssessmentView;
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

/**
 * Keyed by the closed action set, not by `string`: a total map over a one-member
 * union keeps indexing total, so a caller never has to handle `undefined` for a
 * value the contract guarantees.
 */
export const RECOMMENDATION_LABEL: Readonly<Record<AssessmentView["recommendedAction"], string>> = {
  human_review: "Revisión humana"
};

export const riskLabel = (band: AssessmentRiskBand): string => RISK_LABEL[band];

/** Confidence travels as a 0..1 ratio; the screen shows it as a percentage. */
export const confidencePercent = (confidence: number): number => Math.round(confidence * 100);

function TextList({
  label,
  items,
  emptyLabel
}: {
  readonly label: string;
  readonly items: readonly string[];
  readonly emptyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="font-medium">{label}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul aria-label={label} className="list-disc pl-5">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AiAssessmentPanel({ assessment }: AiAssessmentPanelProps) {
  const { provenance } = assessment;
  const isSimulated = provenance.source === "simulated";

  return (
    <section
      aria-label="Evaluación de IA"
      lang="es"
      className="flex flex-col gap-5 rounded-card border border-border p-6"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-lg font-bold tracking-[-0.01em]">Evaluación de IA</h3>
        {isSimulated ? (
          <Badge variant="simulado" label="SIMULADO" lang="es" />
        ) : (
          <Badge variant="risk" label={provenance.model} tone="neutral" />
        )}
        <span className="text-sm text-text-secondary">ID {assessment.assessmentId}</span>
      </header>

      <p className="m-0 text-sm">
        La IA solo asesora: no aprueba, no define límites y no transfiere fondos.{" "}
        {isSimulated
          ? "Esta evaluación es simulada; no corresponde a una llamada en vivo."
          : `Esta evaluación la produjo el modelo ${provenance.model} (${provenance.promptVersion}).`}
      </p>

      {/* Risk band, confidence and recommendation are deliberately separate
          concepts, so they render as three tiles, never one combined score
          (`demo-ui.md` §8 Pantalla 3). */}
      <dl className="m-0 grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 rounded-control border border-border p-4">
          <dt className="text-xs font-medium text-text-secondary">Banda de riesgo</dt>
          <dd className="m-0">
            <Badge
              variant="risk"
              label={RISK_LABEL[assessment.riskBand]}
              tone={RISK_TONE[assessment.riskBand]}
              lang="es"
            />
          </dd>
        </div>
        <div className="flex flex-col gap-1.5 rounded-control border border-border p-4">
          <dt className="text-xs font-medium text-text-secondary">Confianza del modelo</dt>
          <dd className="m-0 text-2xl leading-tight font-bold tabular-nums">
            {`${confidencePercent(assessment.confidence)} %`}
          </dd>
        </div>
        <div className="flex flex-col gap-1.5 rounded-control border border-border p-4">
          <dt className="text-xs font-medium text-text-secondary">Recomendación</dt>
          <dd className="m-0 text-[15px] font-semibold">{RECOMMENDATION_LABEL[assessment.recommendedAction]}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1">
        <h4 className="font-medium">Razones</h4>
        <ul aria-label="Razones" className="m-0 flex list-none flex-col gap-3 p-0">
          {assessment.reasons.map((reason) => (
            <li key={reason.claim} className="flex flex-col gap-1 rounded-control border border-border p-3">
              <span>{reason.claim}</span>
              <span className="flex flex-wrap items-center gap-1 text-sm text-text-secondary">
                Evidencia:
                {reason.evidenceRefs.map((ref) => (
                  <code key={ref}>{ref}</code>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1">
        <h4 className="font-medium">Anomalías</h4>
        {assessment.anomalies.length === 0 ? (
          <p className="m-0 text-sm text-text-secondary">No se detectaron anomalías.</p>
        ) : (
          <ul aria-label="Anomalías" className="list-disc pl-5">
            {assessment.anomalies.map((anomaly) => (
              <li key={`${anomaly.evidenceRef}-${anomaly.type}`}>
                {`${anomaly.type} en ${anomaly.evidenceRef} (${anomaly.severity})`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <TextList
        label="Datos faltantes"
        items={assessment.missingData}
        emptyLabel="No se declararon faltantes."
      />
      <TextList
        label="Preguntas pendientes"
        items={assessment.questions}
        emptyLabel="No quedaron preguntas pendientes."
      />

      <p className="m-0 text-sm text-text-secondary">
        {`Origen: ${provenance.model} · prompt ${provenance.promptVersion} · ${provenance.generatedAt}.`}
      </p>
    </section>
  );
}

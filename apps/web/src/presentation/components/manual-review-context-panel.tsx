import type {
  ApplicationManualReviewContext,
  ApplicationReviewState,
  AssessmentFailureCode,
  ReviewFindingKind,
  SalesPeriodStatus
} from "@vaqcrow/contracts";
import { Badge } from "./badge";

/**
 * ManualReviewContextPanel: read-only presentation of the persisted
 * manual-review context for a failed AI assessment.
 *
 * It renders what the backend stored and nothing else: the sanitized failure
 * code, the validated synthetic evidence, the optional declared provenance
 * (kept labelled when it is `simulated`) and the stored timestamp. It offers no
 * control that could decide anything — the human decision lives in its own
 * block — and it never presents simulated data as a real evaluation.
 */
export interface ManualReviewContextPanelProps {
  readonly context: ApplicationManualReviewContext;
}

const FAILURE_LABEL: Readonly<Record<AssessmentFailureCode, string>> = {
  timeout: "El proveedor de IA no respondió a tiempo; la evaluación quedó sin resultado.",
  provider_unavailable: "El proveedor de IA no estaba disponible cuando se pidió la evaluación.",
  invalid_output:
    "El proveedor respondió, pero su salida no cumple el contrato de evaluación, así que se descartó.",
  unknown_evidence_reference:
    "El proveedor citó evidencia que no se le entregó, así que su respuesta se descartó."
};

const STATE_LABEL: Readonly<Record<ApplicationReviewState, string>> = {
  draft: "Borrador",
  awaiting_assessment: "Esperando evaluación",
  human_review: "Revisión humana",
  approved: "Aprobada",
  changes_requested: "Información solicitada",
  rejected: "Rechazada"
};

const PERIOD_STATUS_LABEL: Readonly<Record<SalesPeriodStatus, string>> = {
  reported: "Declarado",
  missing: "Faltante",
  anomalous: "Anómalo"
};

const FINDING_LABEL: Readonly<Record<ReviewFindingKind, string>> = {
  missing: "Período faltante",
  anomalous: "Período anómalo",
  contradictory: "Serie contradictoria"
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0
});

export function ManualReviewContextPanel({ context }: ManualReviewContextPanelProps) {
  const { providerProvenance } = context;
  const isSimulated = providerProvenance?.source === "simulated";

  return (
    <section
      aria-label="Revisión manual"
      lang="es"
      className="flex flex-col gap-5 rounded-card border border-border p-6"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-lg font-bold tracking-[-0.01em]">Revisión manual</h3>
        {isSimulated ? <Badge variant="simulado" label="SIMULADO" lang="es" /> : null}
      </header>

      <p className="m-0 text-sm">
        La evaluación de IA no produjo un resultado para esta solicitud. No hay una sugerencia del
        modelo que mostrar: una persona debe revisar la evidencia y decidir.
      </p>

      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
        <dt className="text-text-secondary">Motivo del fallo</dt>
        <dd className="m-0">{FAILURE_LABEL[context.failureCode]}</dd>
        <dt className="text-text-secondary">Estado de la solicitud</dt>
        <dd className="m-0">{STATE_LABEL[context.applicationState]}</dd>
        <dt className="text-text-secondary">Registrado</dt>
        <dd className="m-0">{context.recordedAt}</dd>
        <dt className="text-text-secondary">Procedencia</dt>
        <dd className="m-0">
          {providerProvenance ? (
            <span className="flex flex-wrap items-center gap-2">
              <span>{providerProvenance.model}</span>
              <span className="text-sm text-text-secondary">
                {`prompt ${providerProvenance.promptVersion} · ${providerProvenance.generatedAt}`}
              </span>
            </span>
          ) : (
            "Sin procedencia declarada"
          )}
        </dd>
      </dl>

      <div className="flex flex-col gap-1">
        <h4 className="font-medium">Evidencia evaluada</h4>
        <p className="m-0 text-sm text-text-secondary">Serie sintética de la demo; no verificada contra fuentes externas.</p>
        <ul aria-label="Períodos evaluados" className="m-0 flex list-none flex-col gap-2 p-0">
          {context.evidence.periods.map((period) => (
            <li
              key={period.evidenceRef}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-border p-3"
            >
              <code>{period.evidenceRef}</code>
              <span>{period.period}</span>
              <span>{PERIOD_STATUS_LABEL[period.status]}</span>
              <span className="text-sm text-text-secondary">
                {period.amountArs === null ? "Sin dato declarado" : currency.format(period.amountArs)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1">
        <h4 className="font-medium">Hallazgos</h4>
        {context.evidence.findings.length === 0 ? (
          <p className="m-0 text-sm text-text-secondary">No se registraron hallazgos.</p>
        ) : (
          <ul aria-label="Hallazgos" className="list-disc pl-5">
            {context.evidence.findings.map((finding, index) => (
              <li key={`${finding.kind}-${finding.period ?? index}`}>
                {finding.period ? `${FINDING_LABEL[finding.kind]} · ${finding.period}` : FINDING_LABEL[finding.kind]}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

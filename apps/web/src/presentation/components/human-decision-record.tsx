import type { HumanDecisionOutcome } from "@vaqcrow/contracts";
import type { RecordedHumanDecision } from "@/application/ports/human-decision-gateway";
import { Badge } from "./badge";

/**
 * HumanDecisionRecordView (Issue #62 T6): renders only what the backend
 * returned for a recorded decision, including its server timestamp and
 * correlation id. It is never shown for a failed or unconfirmed attempt.
 */
export interface HumanDecisionRecordViewProps {
  readonly recorded: RecordedHumanDecision;
}

const OUTCOME_LABEL: Readonly<Record<HumanDecisionOutcome, string>> = {
  approved: "Aprobada",
  changes_requested: "Información solicitada",
  rejected: "Rechazada"
};

const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function HumanDecisionRecordView({ recorded }: HumanDecisionRecordViewProps) {
  const { decision } = recorded;

  return (
    <section
      aria-label="Decisión registrada"
      lang="es"
      className="flex flex-col gap-3 rounded-card border border-border p-6"
    >
      <header className="flex flex-wrap items-center gap-2">
        <p role="status" className="m-0 text-lg font-bold">
          Decisión humana registrada
        </p>
        <Badge variant="simulado" label="SIMULADO" lang="es" />
      </header>
      {recorded.applied ? null : (
        <p className="m-0 text-sm">La decisión ya estaba registrada; se muestra el registro existente sin duplicarla.</p>
      )}
      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
        <dt className="text-text-secondary">Decisión</dt>
        <dd className="m-0">{OUTCOME_LABEL[decision.outcome]}</dd>
        <dt className="text-text-secondary">Registrada por</dt>
        <dd className="m-0">{decision.actor}</dd>
        <dt className="text-text-secondary">Razón</dt>
        <dd className="m-0">{decision.reason}</dd>
        <dt className="text-text-secondary">Límite aprobado</dt>
        <dd className="m-0">
          {decision.approvedLimitArs === null
            ? "Sin límite (no aplica a esta decisión)"
            : currency.format(decision.approvedLimitArs)}
        </dd>
        <dt className="text-text-secondary">Fecha del servidor</dt>
        <dd className="m-0">{decision.decidedAt}</dd>
        <dt className="text-text-secondary">ID de correlación</dt>
        <dd className="m-0 font-mono">{decision.correlationId}</dd>
      </dl>
    </section>
  );
}

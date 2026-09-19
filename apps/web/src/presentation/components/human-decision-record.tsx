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
    <section aria-label="Decisión registrada" lang="es" className="flex max-w-xl flex-col gap-3">
      <header className="flex flex-wrap items-center gap-2">
        <p role="status" className="text-lg font-semibold">
          Decisión humana registrada
        </p>
        <Badge variant="simulado" label="SIMULADO" lang="es" />
      </header>
      {recorded.applied ? null : (
        <p className="text-sm">La decisión ya estaba registrada; se muestra el registro existente sin duplicarla.</p>
      )}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
        <dt>Decisión</dt>
        <dd>{OUTCOME_LABEL[decision.outcome]}</dd>
        <dt>Registrada por</dt>
        <dd>{decision.actor}</dd>
        <dt>Razón</dt>
        <dd>{decision.reason}</dd>
        <dt>Límite aprobado</dt>
        <dd>
          {decision.approvedLimitArs === null
            ? "Sin límite (no aplica a esta decisión)"
            : currency.format(decision.approvedLimitArs)}
        </dd>
        <dt>Fecha del servidor</dt>
        <dd>{decision.decidedAt}</dd>
        <dt>ID de correlación</dt>
        <dd>{decision.correlationId}</dd>
      </dl>
    </section>
  );
}

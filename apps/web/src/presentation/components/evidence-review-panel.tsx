import { useId } from "react";
import type {
  EvidenceReviewItem,
  ReviewEvidence,
  ReviewItemKind
} from "@/application/evidence/review-view-model";
import { Badge } from "./badge";

/**
 * EvidenceReviewPanel (Task #56 / T4). Renders already-derived findings and
 * evidence-resolution results as supplied: it never computes findings, never
 * fills a missing value, and never invents provenance for an unresolved
 * reference. Copy makes no causal claim about anomalies.
 */
export interface EvidenceReviewPanelProps {
  readonly findings: readonly EvidenceReviewItem[];
  /** SIMULADO label sourced from the fixture/request record, never hardcoded here. */
  readonly simuladoLabel: string;
}

const KIND_TITLE: Readonly<Record<ReviewItemKind, string>> = {
  missing: "Dato faltante",
  anomalous: "Requiere revisión",
  contradictory: "Total declarado no coincide"
};

const KIND_DESCRIPTION: Readonly<Record<ReviewItemKind, string>> = {
  missing: "El período no tiene ventas declaradas. Se muestra como faltante y no se completa.",
  anomalous: "El valor del período se aparta del resto de la serie y necesita revisión humana.",
  contradictory:
    "El total declarado en la solicitud no coincide con la suma de las ventas informadas."
};

function EvidenceLine({ evidence }: { readonly evidence: ReviewEvidence }) {
  if (evidence.status === "unresolved") {
    return (
      <p>
        Evidencia sin resolver: <code>{evidence.ref}</code>
      </p>
    );
  }
  return (
    <p>
      Evidencia: <code>{evidence.ref}</code> — Procedencia: {evidence.provenance}
    </p>
  );
}

function FindingItem({
  item,
  simuladoLabel
}: {
  readonly item: EvidenceReviewItem;
  readonly simuladoLabel: string;
}) {
  const titleId = useId();
  const periodId = useId();
  const labelledBy = item.periodLabel ? `${titleId} ${periodId}` : titleId;

  return (
    <li aria-labelledby={labelledBy} data-kind={item.kind} className="flex flex-col gap-1">
      <p>
        <strong id={titleId}>{KIND_TITLE[item.kind]}</strong>
        {item.periodLabel ? (
          <>
            {" — "}
            <span id={periodId}>{item.periodLabel}</span>
          </>
        ) : null}
      </p>
      <p>{KIND_DESCRIPTION[item.kind]}</p>
      {item.kind === "missing" ? <p>Valor del período: Dato faltante</p> : null}
      {item.kind === "contradictory" ? (
        <dl className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-2">
            <dt>Total declarado:</dt>
            <dd className="inline-flex items-center gap-2">
              {item.declaredTotal !== undefined ? (
                <>
                  <span>{item.declaredTotal}</span>
                  <Badge variant="simulado" label={simuladoLabel} lang="es" />
                </>
              ) : (
                <span>Dato faltante</span>
              )}
            </dd>
          </div>
          <div className="inline-flex items-center gap-2">
            <dt>Suma de ventas informadas:</dt>
            <dd className="inline-flex items-center gap-2">
              {item.reportedTotal !== undefined ? (
                <>
                  <span>{item.reportedTotal}</span>
                  <Badge variant="simulado" label={simuladoLabel} lang="es" />
                </>
              ) : (
                <span>Dato faltante</span>
              )}
            </dd>
          </div>
        </dl>
      ) : null}
      {item.evidence ? <EvidenceLine evidence={item.evidence} /> : null}
    </li>
  );
}

export function EvidenceReviewPanel({ findings, simuladoLabel }: EvidenceReviewPanelProps) {
  return (
    <section lang="es" aria-label="Revisión de evidencia" aria-live="polite">
      {findings.length === 0 ? (
        <p>Sin hallazgos para revisar.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {findings.map((item, index) => (
            <FindingItem
              key={`${item.kind}-${item.periodLabel ?? "request"}-${index}`}
              item={item}
              simuladoLabel={simuladoLabel}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

import { Fragment } from "react";
import type { EvidenceEntry, EvidenceEntryState } from "@/application/evidence/evidence-timeline";
import { microcopy } from "@/application/trust/disclosures";
import { Badge } from "./badge";
import { DistributionCalculation } from "./distribution-calculation";
import { HashDisplay } from "./hash-display";

/**
 * EvidenceTimeline (Feature #29 / Task #92, T92-04): the ordered recap of the
 * demo run — synthetic case, human decision, campaign vault and revenue-share
 * distribution — built from the entries `buildEvidenceTimeline` already
 * decided. Presentational only: props in, no gateway, no `fetch`, no
 * arithmetic; every string arrives pre-formatted by the projection.
 *
 * A state is always visible text, never colour alone: `observed`, `absent` and
 * `unavailable` each render their own word and carry it as `data-state` so the
 * distinction survives a greyscale render and assistive tech. The adopted
 * success tone is not used here: a pending or failed movement is rendered with
 * the wording the projection gave it and can never read as confirmed, and this
 * recap makes no confirmed claim of its own. Hashes go through `HashDisplay`
 * with the caller-supplied `explorerUrl`; this component never builds one (`D1`).
 *
 * The recap deliberately does not carry `microcopy.priorRunHash`: a hash read
 * back from the API cannot tell whether it came from this run or from a rehearsal,
 * so the timeline must not assert either. That disclosure stays where it belongs,
 * as the step's own note.
 */
export interface EvidenceTimelineProps {
  readonly entries: readonly EvidenceEntry[];
  readonly className?: string;
}

const STATE_LABEL: Readonly<Record<EvidenceEntryState, string>> = {
  observed: "Observado",
  absent: "Ausente",
  unavailable: "No disponible"
};

export function EvidenceTimeline({ entries, className }: EvidenceTimelineProps) {
  return (
    <section
      aria-label="Evidencia de la ejecución"
      lang="es"
      className={`flex flex-col gap-4 ${className ?? ""}`.trim()}
    >
      <ol className="m-0 flex list-none flex-col gap-6 p-0">
        {entries.map((entry) => (
          <li
            key={entry.id}
            data-state={entry.state}
            className="flex flex-col gap-4 rounded-card border border-border p-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-lg font-bold tracking-[-0.01em]">{entry.title}</h3>
              {entry.badges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant} label={badge.label} lang="es" />
              ))}
            </div>

            <p className="m-0 text-sm">{entry.description}</p>

            <p className="m-0 text-sm" data-state={entry.state}>
              <span className="font-medium">Estado: </span>
              {STATE_LABEL[entry.state]}
            </p>

            {entry.facts.length > 0 ? (
              <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                {entry.facts.map((fact) => (
                  <Fragment key={fact.label}>
                    <dt className="text-text-secondary">{fact.label}</dt>
                    <dd className="m-0">{fact.value}</dd>
                  </Fragment>
                ))}
              </dl>
            ) : null}

            {entry.hashes.length > 0 ? (
              <div className="flex flex-col gap-2">
                {entry.hashes.map((hash) => (
                  <HashDisplay
                    key={hash.label}
                    label={hash.label}
                    value={hash.value}
                    {...(hash.explorerUrl === undefined ? {} : { explorerUrl: hash.explorerUrl })}
                  />
                ))}
                <p className="m-0 text-xs text-text-secondary">{microcopy.hashTechnicalOnly}</p>
              </div>
            ) : null}

            {entry.calculation ? (
              <DistributionCalculation
                heading={entry.calculation.heading}
                ruleId={entry.calculation.ruleId}
                inputs={entry.calculation.inputs}
                rounding={entry.calculation.rounding}
                total={entry.calculation.total}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

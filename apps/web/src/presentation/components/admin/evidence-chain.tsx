import type { IconType } from "react-icons";
import {
  IoAlertCircleOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoCreateOutline,
  IoHourglassOutline,
  IoOpenOutline,
  IoRemoveCircleOutline,
  IoSyncOutline
} from "react-icons/io5";
import {
  EVIDENCE_COPY,
  SIN_DATO,
  type AdminEvidenceChain,
  type AdminEvidenceFact,
  type AdminEvidenceIcon,
  type AdminEvidenceItem,
  type AdminEvidenceProof,
  type AdminEvidenceStatus,
  type AdminEvidenceStep,
  type AdminEvidenceTone
} from "@/application/admin/evidence";
import { Badge } from "../badge";
import { EmptyState } from "../empty-state";
import { HashDisplay, truncateMiddle } from "../hash-display";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export const EVIDENCE_ICONS: Readonly<Record<AdminEvidenceIcon, IconType>> = {
  check: IoCheckmarkCircleOutline,
  hourglass: IoHourglassOutline,
  sync: IoSyncOutline,
  create: IoCreateOutline,
  close: IoCloseCircleOutline,
  alert: IoAlertCircleOutline,
  missing: IoRemoveCircleOutline
};

/** The rail marker: the template's tone surfaces; `neutral` is its outlined «Evidencia faltante» treatment. */
const MARKER_CLASS: Readonly<Record<AdminEvidenceTone, string>> = {
  neutral: "border border-page-border bg-raised text-text-secondary",
  info: "bg-trust-info-surface text-trust-info",
  caution: "bg-trust-caution-surface text-trust-caution",
  success: "bg-trust-success-surface text-trust-success",
  critical: "bg-trust-critical-surface text-trust-critical"
};

function StatusBadge({ status }: { status: AdminEvidenceStatus }) {
  return (
    <Badge
      variant="transaction"
      tone={status.tone}
      icon={EVIDENCE_ICONS[status.icon]}
      label={status.label}
      lang="es"
    />
  );
}

function MissingEvidence() {
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span>{SIN_DATO}</span>
      <Badge variant="evidence" tone="neutral" icon={IoRemoveCircleOutline} label={EVIDENCE_COPY.missingEvidence} lang="es" />
    </span>
  );
}

function FactValue({ fact }: { fact: AdminEvidenceFact }) {
  if (fact.kind !== "account") return <>{fact.value}</>;
  const short = truncateMiddle(fact.value);
  return (
    <span title={fact.value} className="font-mono text-[13px]">
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{fact.value}</span>
    </span>
  );
}

/** The template's `dl` (`Vaqcrow Sistema.dc.html`, «Revisión antes de firmar»): a term column, then the value. */
function FactList({ facts }: { facts: readonly AdminEvidenceFact[] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[140px_minmax(0,1fr)]">
      {facts.map((fact) => (
        <div key={fact.term} className="contents">
          <dt className="text-text-secondary">{fact.term}</dt>
          <dd className="m-0 mb-1.5 break-words sm:mb-0">
            <FactValue fact={fact} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A step-level proof (vault contract, deploy hash) in the shared `HashDisplay`, or «Sin dato». */
function StepProof({ proof }: { proof: AdminEvidenceProof }) {
  if (proof.value === null) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{proof.label}</span>
        <MissingEvidence />
      </div>
    );
  }
  return (
    <HashDisplay
      label={proof.label}
      value={proof.value}
      {...(proof.explorerUrl === null ? {} : { explorerUrl: proof.explorerUrl })}
    />
  );
}

/**
 * A list row's proof: the template's compact contract row («CDLZ…7Q4K
 * Explorador», `Vaqcrow Sistema.dc.html`) — the truncated value with its full
 * text kept for assistive tech, and the explorer link only when the API sent one.
 */
function InlineProof({ proof }: { proof: AdminEvidenceProof }) {
  if (proof.value === null) return <MissingEvidence />;
  const short = truncateMiddle(proof.value);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-sm text-text-secondary">{proof.label}</span>
      <span title={proof.value} className="font-mono text-[13px] break-all">
        <span aria-hidden="true">{short}</span>
        <span className="sr-only">{proof.value}</span>
      </span>
      {proof.explorerUrl === null ? null : (
        <a
          href={proof.explorerUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`Ver ${proof.label.charAt(0).toLowerCase()}${proof.label.slice(1)} ${proof.value} en el explorador (abre en una pestaña nueva)`}
          className={`inline-flex items-center gap-1 rounded text-[13px] font-semibold text-brand-accent-text ${FOCUS_RING}`}
        >
          {EVIDENCE_COPY.explorer}
          <IoOpenOutline aria-hidden="true" focusable="false" className="text-[15px]" />
        </a>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: AdminEvidenceItem }) {
  return (
    <li className="flex flex-col gap-2.5 border-t border-page-border py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-[15px] font-[650]">{item.heading}</h3>
        {item.status ? <StatusBadge status={item.status} /> : null}
      </div>
      <FactList facts={item.facts} />
      <InlineProof proof={item.proof} />
    </li>
  );
}

function StepCard({ step, last }: { step: AdminEvidenceStep; last: boolean }) {
  const Icon = EVIDENCE_ICONS[step.status.icon];
  const headingId = `evidence-step-${step.id}`;
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 sm:gap-x-4" data-step={step.id}>
      {/* The rail: a decorative marker repeating the status (the badge carries it in words) and the link to the next step. */}
      <div aria-hidden="true" className="flex flex-col items-center">
        <span className={`grid size-9 shrink-0 place-items-center rounded-pill ${MARKER_CLASS[step.status.tone]}`}>
          <Icon focusable="false" className="text-lg" />
        </span>
        {last ? null : <span className="w-0.5 flex-1 bg-page-border" />}
      </div>
      <section
        aria-labelledby={headingId}
        className={`flex min-w-0 flex-col gap-3 rounded-card border border-page-border bg-raised p-[18px] text-text-primary sm:p-[22px] ${
          last ? "" : "mb-5"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={headingId} className="m-0 text-lg font-bold">
            {step.title}
          </h2>
          <StatusBadge status={step.status} />
        </div>
        {step.description ? <p className="m-0 text-sm leading-normal text-text-secondary">{step.description}</p> : null}
        <FactList facts={step.facts} />
        {step.proofs.length > 0 ? (
          <div className="flex flex-col gap-4">
            {step.proofs.map((proof) => (
              <StepProof key={proof.label} proof={proof} />
            ))}
          </div>
        ) : null}
        {step.items && step.items.length > 0 ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {step.items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        ) : null}
        {step.empty ? (
          <EmptyState
            title={step.empty.title}
            body={step.empty.body}
            icon={IoRemoveCircleOutline}
            className="rounded-control bg-page-surface p-5"
          />
        ) : null}
        {step.note ? (
          <p className="m-0 rounded-control bg-page-surface p-3 text-[13px] leading-[1.45]">{step.note}</p>
        ) : null}
      </section>
    </li>
  );
}

/**
 * The ADMIN Testnet evidence chain (#438 WU4, owner decision D3). The template
 * does not draw this screen; it is composed from the admin console's own
 * pieces — the step cards of the review (`rounded-card`, 22 px padding, 18 px
 * bold titles numbered «N · …»), the template's badge row (tone surfaces,
 * «Evidencia faltante», «Pendiente de confirmación», «Confirmada»), its hash
 * surface and its «Ver en el explorador» link. The connected rail is the one
 * new arrangement: it makes the order of the proof the shape of the page.
 * Presentational only; every string arrives from `buildAdminEvidenceChain`.
 */
export function EvidenceChain({ chain }: { chain: AdminEvidenceChain }) {
  return (
    <ol aria-label={EVIDENCE_COPY.chainLabel} className="m-0 flex list-none flex-col p-0">
      {chain.steps.map((step, index) => (
        <StepCard key={step.id} step={step} last={index === chain.steps.length - 1} />
      ))}
    </ol>
  );
}

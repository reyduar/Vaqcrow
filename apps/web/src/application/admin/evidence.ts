import type {
  AdminApplicationEvidence,
  AdminEvidenceContribution,
  AdminEvidenceDecision,
  AdminEvidenceDeployment,
  AdminEvidenceDistribution,
  AdminEvidenceReconciliation,
  AdminEvidenceVault,
  CampaignState,
  HumanDecisionOutcome
} from "@vaqcrow/contracts";
import { MY_CAMPAIGN_DISTRIBUTION_STATE_COPY } from "@/application/company/distributions";
import { formatArsAmount, formatMonthYear, formatXlmAmount } from "@/application/company/format";
import { formatStroopsAsXlm } from "@/application/format/stroops";
import { failureReasonCopy } from "@/application/funding/failure-reason-copy";
import { microcopy } from "@/application/trust/disclosures";
import { MISSING_BUSINESS_LABEL, QUEUE_STATE_COPY, queueDisplayState, type QueueStateCopy } from "./queue";

/**
 * Pure model of the ADMIN Testnet evidence chain
 * (`/admin/pymes/[applicationId]/evidence`, Feature #438 WU4, owner decision
 * D3). React-free: it turns the `AdminApplicationEvidence` read into an ordered
 * chain of six steps — solicitud → decisión humana → despliegue → aportes →
 * distribuciones → reconciliación — each with a status in words plus an icon
 * key, its facts and its proofs.
 *
 * Rules (`docs/design/demo-ui.md` §2): an absent datum is «Sin dato», never a
 * zero; the success tone is only used for something recorded or confirmed on
 * the ledger (a confirmed vault, a confirmed contribution or distribution, a
 * stored «Conciliado»), never for a sent-but-unconfirmed transaction; explorer
 * links are the API's own and stay `null` when it sent none. Dates render in
 * UTC so the same instant reads the same everywhere.
 */

export const SIN_DATO = MISSING_BUSINESS_LABEL;

export type AdminEvidenceTone = "neutral" | "info" | "caution" | "success" | "critical";

export type AdminEvidenceIcon = "check" | "hourglass" | "sync" | "create" | "close" | "alert" | "missing";

export interface AdminEvidenceStatus {
  readonly label: string;
  readonly tone: AdminEvidenceTone;
  readonly icon: AdminEvidenceIcon;
}

export interface AdminEvidenceFact {
  readonly term: string;
  readonly value: string;
  /** `account` values are Stellar public keys the view middle-truncates. */
  readonly kind?: "account";
}

/** A hash or contract address; `value: null` is the honest «Sin dato». */
export interface AdminEvidenceProof {
  readonly label: string;
  readonly value: string | null;
  readonly explorerUrl: string | null;
}

export interface AdminEvidenceItem {
  readonly id: string;
  readonly heading: string;
  readonly status: AdminEvidenceStatus | null;
  readonly facts: readonly AdminEvidenceFact[];
  readonly proof: AdminEvidenceProof;
}

export interface AdminEvidenceEmpty {
  readonly title: string;
  readonly body: string;
}

export type AdminEvidenceStepId =
  | "application"
  | "decision"
  | "deployment"
  | "contributions"
  | "distributions"
  | "reconciliation";

export interface AdminEvidenceStep {
  readonly id: AdminEvidenceStepId;
  readonly title: string;
  readonly status: AdminEvidenceStatus;
  readonly description: string | null;
  readonly facts: readonly AdminEvidenceFact[];
  readonly proofs: readonly AdminEvidenceProof[];
  /** Only the list steps (aportes, distribuciones) carry items; `[]` is an empty list. */
  readonly items: readonly AdminEvidenceItem[] | null;
  readonly empty: AdminEvidenceEmpty | null;
  readonly note: string | null;
}

export interface AdminEvidenceHeader {
  readonly title: string;
  readonly subline: string;
  readonly state: QueueStateCopy;
}

export interface AdminEvidenceChain {
  readonly header: AdminEvidenceHeader;
  readonly trustNote: string;
  readonly steps: readonly AdminEvidenceStep[];
}

/**
 * Copy the template does not draw (owner-pending, recorded in the task log).
 * The trust note and the human-decision note are the canonical microcopy.
 */
export const EVIDENCE_COPY = Object.freeze({
  breadcrumb: "Evidencia",
  linkLabel: "Evidencia",
  reviewLinkLabel: "Ver evidencia Testnet",
  backToReview: "Revisión",
  trustNote: microcopy.hashTechnicalOnly,
  testnetBadge: microcopy.testnetBadge,
  humanDecisionNote: microcopy.humanDecision,
  chainLabel: "Cadena de evidencia",
  loading: "Cargando evidencia…",
  notFound: "No encontramos esta solicitud.",
  backToQueue: "Volver a PyMEs",
  loadError: "No pudimos cargar la evidencia.",
  loadErrorDetail: "No se modificó ningún dato. Podés reintentar.",
  explorer: "Ver en el explorador",
  missingEvidence: "Evidencia faltante",
  deploymentDescription:
    "La plataforma despliega la bóveda en Stellar Testnet después de la aprobación; el destino de los fondos es la cuenta de la PyME y es inmutable.",
  reconciliationDescription:
    "Es el último estado guardado al leer la bóveda; esta vista no consulta la red.",
  contributionsEmpty: Object.freeze({
    title: "Todavía no hay aportes confirmados",
    body: "Cuando el ledger de Stellar Testnet confirme un aporte a la bóveda, aparece acá con su hash. Los aportes anteriores al registro de hashes no tienen dato."
  }),
  distributionsEmpty: Object.freeze({
    title: "Todavía no hay distribuciones",
    body: "Cuando la PyME firme la distribución de un período, aparece acá con su hash y su estado de confirmación."
  })
});

const UTC_DATE_TIME = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC"
});

/** `2026-10-07T15:30:00Z` → `07/10/2026 15:30 UTC`; an unreadable date is «Sin dato». */
export function formatEvidenceDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return SIN_DATO;
  const parts = Object.fromEntries(UTC_DATE_TIME.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts["day"]}/${parts["month"]}/${parts["year"]} ${parts["hour"]}:${parts["minute"]} UTC`;
}

/** A decimal stroop string → `250,5000000 XLM`, without ever passing money through a float of stroops. */
export function formatEvidenceXlm(stroops: string): string {
  return formatXlmAmount(formatStroopsAsXlm(BigInt(stroops)));
}

const MISSING_STATUS = (label: string): AdminEvidenceStatus => ({ label, tone: "neutral", icon: "missing" });

const DECISION_STATUS: Readonly<Record<HumanDecisionOutcome, AdminEvidenceStatus>> = Object.freeze({
  approved: { label: "Aprobada", tone: "success", icon: "check" },
  changes_requested: { label: "Requiere cambios", tone: "info", icon: "create" },
  rejected: { label: "Rechazada", tone: "critical", icon: "close" }
});

const DEPLOYMENT_STATUS: Readonly<Record<AdminEvidenceDeployment["state"], AdminEvidenceStatus>> = Object.freeze({
  pending: { label: "Pendiente de confirmación", tone: "caution", icon: "hourglass" },
  deploying: { label: "Desplegando bóveda", tone: "info", icon: "sync" },
  confirmed: { label: "Bóveda confirmada", tone: "success", icon: "check" },
  failed: { label: "Despliegue fallido", tone: "critical", icon: "alert" }
});

const VAULT_STATE_COPY: Readonly<Record<CampaignState, string>> = Object.freeze({
  funding: "Fondeo abierto",
  settled: "Meta alcanzada",
  refunding: "Reembolso disponible"
});

const DISTRIBUTION_STATUS: Readonly<Record<AdminEvidenceDistribution["state"], AdminEvidenceStatus>> = Object.freeze({
  submitted: { label: MY_CAMPAIGN_DISTRIBUTION_STATE_COPY.submitted, tone: "caution", icon: "hourglass" },
  confirmed: { label: MY_CAMPAIGN_DISTRIBUTION_STATE_COPY.confirmed, tone: "success", icon: "check" },
  failed: { label: MY_CAMPAIGN_DISTRIBUTION_STATE_COPY.failed, tone: "critical", icon: "close" }
});

const TRANSACTION_HASH_LABEL = "Hash de la transacción";

function step(
  id: AdminEvidenceStepId,
  position: number,
  name: string,
  status: AdminEvidenceStatus,
  rest: Partial<Omit<AdminEvidenceStep, "id" | "title" | "status">> = {}
): AdminEvidenceStep {
  return {
    id,
    title: `${position} · ${name}`,
    status,
    description: rest.description ?? null,
    facts: rest.facts ?? [],
    proofs: rest.proofs ?? [],
    items: rest.items ?? null,
    empty: rest.empty ?? null,
    note: rest.note ?? null
  };
}

function applicationStep(evidence: AdminApplicationEvidence): AdminEvidenceStep {
  const state = QUEUE_STATE_COPY[queueDisplayState(evidence.applicationState)];
  return step("application", 1, "Solicitud", state, {
    facts: [
      { term: "Empresa", value: evidence.companyName ?? SIN_DATO },
      { term: "Referencia", value: evidence.smeReference },
      { term: "ID", value: evidence.applicationId }
    ]
  });
}

function decisionStep(decision: AdminEvidenceDecision | null): AdminEvidenceStep {
  if (decision === null) {
    return step("decision", 2, "Decisión humana", MISSING_STATUS("Sin decisión registrada"), {
      description: "Todavía nadie registró una decisión sobre esta solicitud.",
      note: EVIDENCE_COPY.humanDecisionNote
    });
  }
  return step("decision", 2, "Decisión humana", DECISION_STATUS[decision.outcome], {
    facts: [
      { term: "Decidió", value: decision.actor },
      { term: "Razón", value: decision.reason },
      {
        term: "Límite aprobado",
        value: decision.approvedLimitArs === null ? SIN_DATO : formatArsAmount(decision.approvedLimitArs)
      },
      { term: "Fecha", value: formatEvidenceDateTime(decision.decidedAt) }
    ],
    note: EVIDENCE_COPY.humanDecisionNote
  });
}

function deploymentStep(
  deployment: AdminEvidenceDeployment | null,
  vault: AdminEvidenceVault | null
): AdminEvidenceStep {
  if (vault === null) {
    const status = deployment === null ? MISSING_STATUS("Sin despliegue registrado") : DEPLOYMENT_STATUS[deployment.state];
    return step("deployment", 3, "Despliegue de la bóveda", status, {
      description: EVIDENCE_COPY.deploymentDescription
    });
  }
  return step("deployment", 3, "Despliegue de la bóveda", DEPLOYMENT_STATUS.confirmed, {
    description: EVIDENCE_COPY.deploymentDescription,
    facts: [
      { term: "Estado de la bóveda", value: VAULT_STATE_COPY[vault.state] },
      { term: "Meta", value: formatEvidenceXlm(vault.goalStroops) },
      { term: "Aportado", value: formatEvidenceXlm(vault.totalStroops) },
      { term: "Plazo", value: formatEvidenceDateTime(vault.deadline) }
    ],
    proofs: [
      { label: "Contrato de la bóveda", value: vault.contractAddress, explorerUrl: vault.vaultExplorerUrl },
      { label: "Hash del despliegue", value: vault.deployTransactionHash, explorerUrl: vault.deployExplorerUrl }
    ]
  });
}

function contributionItem(contribution: AdminEvidenceContribution): AdminEvidenceItem {
  return {
    id: contribution.transactionHash,
    heading: formatEvidenceXlm(contribution.amountStroops),
    status: null,
    facts: [
      { term: "Inversor", value: contribution.investorAccountId, kind: "account" },
      { term: "Observado", value: formatEvidenceDateTime(contribution.observedAt) }
    ],
    proof: { label: TRANSACTION_HASH_LABEL, value: contribution.transactionHash, explorerUrl: contribution.explorerUrl }
  };
}

function contributionsStep(contributions: readonly AdminEvidenceContribution[]): AdminEvidenceStep {
  const count = contributions.length;
  const status: AdminEvidenceStatus =
    count === 0
      ? MISSING_STATUS("Sin aportes confirmados")
      : {
          label: count === 1 ? "1 confirmado en el ledger" : `${count} confirmados en el ledger`,
          tone: "success",
          icon: "check"
        };
  return step("contributions", 4, "Aportes", status, {
    items: contributions.map(contributionItem),
    ...(count === 0 ? { empty: EVIDENCE_COPY.contributionsEmpty } : {})
  });
}

function distributionFacts(distribution: AdminEvidenceDistribution): AdminEvidenceFact[] {
  const facts: AdminEvidenceFact[] = [
    { term: "Total", value: formatEvidenceXlm(distribution.totalStroops) },
    { term: "Destinatarios", value: String(distribution.recipientCount) },
    { term: "Enviada", value: formatEvidenceDateTime(distribution.createdAt) }
  ];
  if (distribution.state === "failed") {
    facts.push({
      term: "Motivo",
      value: distribution.failureReason === null ? SIN_DATO : failureReasonCopy(distribution.failureReason)
    });
    return facts;
  }
  facts.push({
    term: "Confirmada",
    value:
      distribution.confirmedAt === null
        ? distribution.state === "submitted"
          ? "Pendiente de confirmación"
          : SIN_DATO
        : formatEvidenceDateTime(distribution.confirmedAt)
  });
  facts.push({ term: "Ledger", value: distribution.ledgerSequence ?? SIN_DATO });
  return facts;
}

function distributionItem(distribution: AdminEvidenceDistribution): AdminEvidenceItem {
  return {
    id: distribution.distributionId,
    heading: distribution.period === null ? "Sin período" : formatMonthYear(distribution.period),
    status: DISTRIBUTION_STATUS[distribution.state],
    facts: distributionFacts(distribution),
    proof: { label: TRANSACTION_HASH_LABEL, value: distribution.transactionHash, explorerUrl: distribution.explorerUrl }
  };
}

function distributionsStep(distributions: readonly AdminEvidenceDistribution[]): AdminEvidenceStep {
  const total = distributions.length;
  const confirmed = distributions.filter((distribution) => distribution.state === "confirmed").length;
  const failed = distributions.some((distribution) => distribution.state === "failed");
  const label = `${confirmed} de ${total} ${total === 1 ? "confirmada" : "confirmadas"}`;
  let status: AdminEvidenceStatus;
  if (total === 0) status = MISSING_STATUS("Sin distribuciones");
  else if (confirmed === total) status = { label, tone: "success", icon: "check" };
  else if (failed) status = { label, tone: "critical", icon: "alert" };
  else status = { label, tone: "caution", icon: "hourglass" };
  return step("distributions", 5, "Distribuciones", status, {
    items: distributions.map(distributionItem),
    ...(total === 0 ? { empty: EVIDENCE_COPY.distributionsEmpty } : {})
  });
}

function reconciliationStep(reconciliation: AdminEvidenceReconciliation | null): AdminEvidenceStep {
  if (reconciliation === null) {
    return step("reconciliation", 6, "Reconciliación", MISSING_STATUS("Sin conciliación registrada"), {
      description: EVIDENCE_COPY.reconciliationDescription
    });
  }
  const status: AdminEvidenceStatus =
    reconciliation.status === "in_sync"
      ? { label: "Conciliado", tone: "success", icon: "check" }
      : { label: "Divergente", tone: "critical", icon: "alert" };
  return step("reconciliation", 6, "Reconciliación", status, {
    description: EVIDENCE_COPY.reconciliationDescription,
    facts: [
      { term: "Última conciliación", value: formatEvidenceDateTime(reconciliation.lastReconciledAt) },
      {
        term: "Última divergencia",
        value:
          reconciliation.lastDivergedAt === null
            ? "Sin divergencias registradas"
            : formatEvidenceDateTime(reconciliation.lastDivergedAt)
      }
    ]
  });
}

export function buildAdminEvidenceChain(evidence: AdminApplicationEvidence): AdminEvidenceChain {
  return {
    header: {
      title: `Evidencia: ${evidence.companyName ?? SIN_DATO}`,
      subline: `${evidence.smeReference} · ${evidence.applicationId}`,
      state: QUEUE_STATE_COPY[queueDisplayState(evidence.applicationState)]
    },
    trustNote: EVIDENCE_COPY.trustNote,
    steps: [
      applicationStep(evidence),
      decisionStep(evidence.decision),
      deploymentStep(evidence.deployment, evidence.vault),
      contributionsStep(evidence.contributions),
      distributionsStep(evidence.distributions),
      reconciliationStep(evidence.reconciliation)
    ]
  };
}

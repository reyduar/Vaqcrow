import type {
  CampaignSnapshot,
  CampaignState,
  HumanDecisionOutcome,
  HumanDecisionRecord,
  ReconciliationStatus,
  RevenueShareDistributionSnapshot,
  RevenueShareDistributionState
} from "@vaqcrow/contracts";
import { DEMO_DISTRIBUTION_RULE_VERSION } from "@/application/distribution/demo-distribution-recipients";
import { formatStroopsAsXlm } from "@/application/format/stroops";
import { failureReasonCopy } from "@/application/funding/failure-reason-copy";
import { microcopy } from "@/application/trust/disclosures";

/**
 * One source as the page could actually read it. The three kinds are explicit
 * so a source that was never read in this session (`absent`) can never be
 * confused with one that was attempted and failed (`unavailable`), and neither
 * can be rendered as if it had produced data (`observed`).
 */
export type EvidenceSource<T> =
  | { readonly kind: "observed"; readonly value: T }
  | { readonly kind: "absent" }
  | { readonly kind: "unavailable" };

export interface EvidenceSources {
  readonly applicationId: string;
  readonly decision: EvidenceSource<HumanDecisionRecord>;
  readonly campaign: EvidenceSource<CampaignSnapshot>;
  readonly distribution: EvidenceSource<RevenueShareDistributionSnapshot>;
}

export type EvidenceEntryState = "observed" | "absent" | "unavailable";

export interface EvidenceBadgeSpec {
  readonly variant: "simulado" | "testnet" | "evidence" | "transaction" | "fallback";
  readonly label: string;
}

export interface EvidenceFact {
  readonly label: string;
  readonly value: string;
}

export interface EvidenceHash {
  readonly label: string;
  readonly value: string;
  readonly explorerUrl?: string;
}

export interface EvidenceCalculation {
  readonly heading: string;
  readonly ruleId: string;
  readonly inputs: readonly EvidenceFact[];
  readonly rounding: string;
  readonly total: EvidenceFact;
}

export interface EvidenceEntry {
  readonly id: "synthetic-case" | "human-decision" | "campaign-vault" | "revenue-share-distribution";
  readonly title: string;
  readonly state: EvidenceEntryState;
  readonly description: string;
  readonly badges: readonly EvidenceBadgeSpec[];
  readonly facts: readonly EvidenceFact[];
  readonly hashes: readonly EvidenceHash[];
  /** Only on the distribution entry, when its amounts are readable. */
  readonly calculation?: EvidenceCalculation;
}

const SIMULADO_LABEL = "SIMULADO";

/** Testnet is context, not a claim of execution: both movements carry it in every state. */
const TESTNET_BADGE: EvidenceBadgeSpec = { variant: "testnet", label: microcopy.testnetBadge };
const EVIDENCE_BADGE: EvidenceBadgeSpec = { variant: "evidence", label: "Contrato de la bóveda" };
const TRANSACTION_BADGE: EvidenceBadgeSpec = { variant: "transaction", label: "Transacción de la distribución" };

const CAMPAIGN_STATE_COPY: Readonly<Record<CampaignState, string>> = {
  funding: "Fondeo abierto",
  settled: "Meta alcanzada",
  refunding: "Reembolso disponible"
};

const RECONCILIATION_COPY: Readonly<Record<ReconciliationStatus, string>> = {
  in_sync: "En sincronía con el ledger",
  diverged: "Divergente; pendiente de reconciliación"
};

const DECISION_OUTCOME_COPY: Readonly<Record<HumanDecisionOutcome, string>> = {
  approved: "Aprobada",
  changes_requested: "Información solicitada",
  rejected: "Rechazada"
};

const DISTRIBUTION_STATE_COPY: Readonly<Record<RevenueShareDistributionState, string>> = {
  submitted: "Enviada · pendiente de confirmación",
  confirmed: "Confirmada en el ledger",
  failed: "Fallida"
};

/** Same locale and precision as the decision record view; the projection only pre-formats, it never re-decides. */
const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0
});

/** Display aggregation of the amounts the API returned; the API remains the authority for the obligation. */
function sumStroops(recipients: readonly { readonly amountStroops: bigint }[]): bigint {
  return recipients.reduce((sum, recipient) => sum + recipient.amountStroops, 0n);
}

function absentOrUnavailable(
  state: Exclude<EvidenceEntryState, "observed">,
  description: string
): Pick<EvidenceEntry, "state" | "description"> {
  return { state, description };
}

/** The demo's own synthetic case is always part of the run; it is not one of the three read sources. */
function syntheticCaseEntry(applicationId: string): EvidenceEntry {
  return {
    id: "synthetic-case",
    title: "Caso simulado",
    state: "observed",
    description:
      "Caso de demostración con identidad, KYC/KYB y ventas simuladas; no representa verificaciones ni movimientos de dinero real.",
    badges: [{ variant: "simulado", label: SIMULADO_LABEL }],
    facts: [{ label: "Solicitud", value: applicationId }],
    hashes: []
  };
}

function decisionEntry(source: EvidenceSource<HumanDecisionRecord>): EvidenceEntry {
  const base = {
    id: "human-decision" as const,
    title: "Decisión humana",
    // A recorded decision is real and human, never a simulated value: no SIMULADO badge.
    badges: [] as readonly EvidenceBadgeSpec[],
    hashes: [] as readonly EvidenceHash[]
  };

  if (source.kind !== "observed") {
    const reason =
      source.kind === "absent"
        ? "No hay una decisión humana registrada para esta solicitud."
        : "No se pudo leer la decisión humana en esta sesión.";
    return { ...base, facts: [], ...absentOrUnavailable(source.kind, reason) };
  }

  const decision = source.value;
  const facts: EvidenceFact[] = [
    { label: "Registrada por", value: decision.actor },
    { label: "Decisión", value: DECISION_OUTCOME_COPY[decision.outcome] },
    { label: "Razón", value: decision.reason }
  ];
  if (decision.approvedLimitArs !== null) {
    facts.push({ label: "Límite aprobado", value: arsFormatter.format(decision.approvedLimitArs) });
  }
  facts.push({ label: "Fecha del servidor", value: decision.decidedAt });

  return {
    ...base,
    state: "observed",
    description: microcopy.humanDecision,
    facts
  };
}

function campaignEntry(source: EvidenceSource<CampaignSnapshot>): EvidenceEntry {
  const base = {
    id: "campaign-vault" as const,
    title: "Bóveda de campaña",
    badges: [TESTNET_BADGE, EVIDENCE_BADGE] as readonly EvidenceBadgeSpec[]
  };

  if (source.kind !== "observed") {
    const reason =
      source.kind === "absent"
        ? "No hay una bóveda de campaña en esta sesión."
        : "No se pudo leer la bóveda de campaña en esta sesión.";
    return { ...base, facts: [], hashes: [], ...absentOrUnavailable(source.kind, reason) };
  }

  const campaign = source.value;
  const facts: EvidenceFact[] = [
    { label: "Estado", value: CAMPAIGN_STATE_COPY[campaign.state] },
    { label: "Meta", value: `${formatStroopsAsXlm(campaign.goalStroops)} XLM` },
    { label: "Total aportado", value: `${formatStroopsAsXlm(campaign.totalStroops)} XLM` },
    { label: "Fecha límite", value: campaign.deadline },
    { label: "Reconciliación", value: RECONCILIATION_COPY[campaign.reconciliationStatus] }
  ];
  // The investor's own contribution is only knowable when the read asked for it.
  if (campaign.investorContributionStroops !== undefined && campaign.investorContributionStroops !== null) {
    facts.push({ label: "Tu aporte", value: `${formatStroopsAsXlm(campaign.investorContributionStroops)} XLM` });
  }

  return {
    ...base,
    state: "observed",
    description: "Bóveda del contrato que custodia los aportes en Stellar Testnet.",
    facts,
    hashes: [
      {
        label: "Contrato de la bóveda",
        value: campaign.contractAddress,
        // The API supplies the explorer link; the web never builds one (`D1`).
        ...(campaign.explorerUrl === undefined ? {} : { explorerUrl: campaign.explorerUrl })
      }
    ]
  };
}

function distributionEntry(source: EvidenceSource<RevenueShareDistributionSnapshot>): EvidenceEntry {
  const base = {
    id: "revenue-share-distribution" as const,
    title: "Distribución de ingresos",
    badges: [TESTNET_BADGE, TRANSACTION_BADGE] as readonly EvidenceBadgeSpec[]
  };

  if (source.kind !== "observed") {
    const reason =
      source.kind === "absent"
        ? "No hay una distribución de ingresos en esta sesión."
        : "No se pudo leer la distribución de ingresos en esta sesión.";
    return { ...base, facts: [], hashes: [], ...absentOrUnavailable(source.kind, reason) };
  }

  const distribution = source.value;
  const facts: EvidenceFact[] = [
    { label: "Estado", value: DISTRIBUTION_STATE_COPY[distribution.state] },
    { label: "Destinatarios", value: String(distribution.recipients.length) },
    { label: "Total", value: `${formatStroopsAsXlm(sumStroops(distribution.recipients))} XLM` }
  ];
  if (distribution.failureReason !== null) {
    facts.push({ label: "Motivo del fallo", value: failureReasonCopy(distribution.failureReason) });
  }

  const calculation: EvidenceCalculation = {
    heading: "Cálculo de distribución",
    ruleId: `${DEMO_DISTRIBUTION_RULE_VERSION} · ${SIMULADO_LABEL}`,
    inputs: distribution.recipients.map((recipient, index) => ({
      label: `Destinatario ${index + 1}`,
      value: `${formatStroopsAsXlm(recipient.amountStroops)} XLM`
    })),
    rounding: "Hacia abajo (piso), en unidades mínimas",
    total: {
      label: "Total distribuido",
      value: `${formatStroopsAsXlm(sumStroops(distribution.recipients))} XLM`
    }
  };

  return {
    ...base,
    state: "observed",
    description: "Distribución de ingresos registrada en Stellar Testnet.",
    facts,
    hashes: [
      {
        label: "Hash de transacción",
        value: distribution.transactionHash,
        explorerUrl: distribution.explorerUrl
      }
    ],
    calculation
  };
}

/**
 * Projection only: it owns what a state means, orders the four entries and
 * formats what it is given, and performs no I/O. An `absent` or `unavailable`
 * source yields no facts and no hashes — nothing only an observed source could
 * know — so a step that did not happen can never read as if it had.
 */
export function buildEvidenceTimeline(sources: EvidenceSources): readonly EvidenceEntry[] {
  return [
    syntheticCaseEntry(sources.applicationId),
    decisionEntry(sources.decision),
    campaignEntry(sources.campaign),
    distributionEntry(sources.distribution)
  ];
}

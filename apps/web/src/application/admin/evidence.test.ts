import type { AdminApplicationEvidence } from "@vaqcrow/contracts";
import { describe, expect, it } from "vitest";
import {
  buildAdminEvidenceChain,
  EVIDENCE_COPY,
  formatEvidenceDateTime,
  formatEvidenceXlm,
  type AdminEvidenceStep,
  type AdminEvidenceStepId
} from "./evidence";
import { adminEvidencePath } from "./review";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222" as AdminApplicationEvidence["applicationId"];
const CAMPAIGN_ID = "77777777-7777-4777-8777-777777777777";
const CONTRACT = "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
const INVESTOR = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);

const FULL: AdminApplicationEvidence = {
  applicationId: APPLICATION_ID,
  applicationState: "approved",
  smeReference: "sme-001",
  companyName: "Panadería Horizonte SRL",
  decision: {
    actor: "Admin Vaqcrow",
    outcome: "approved",
    reason: "Ventas consistentes y documentación completa.",
    approvedLimitArs: 12_000_000,
    decidedAt: "2026-10-07T15:30:00.000Z"
  },
  deployment: { state: "confirmed", campaignId: CAMPAIGN_ID },
  vault: {
    campaignId: CAMPAIGN_ID,
    contractAddress: CONTRACT,
    vaultExplorerUrl: `https://stellar.expert/explorer/testnet/contract/${CONTRACT}`,
    deployTransactionHash: HASH_A,
    deployExplorerUrl: `https://stellar.expert/explorer/testnet/tx/${HASH_A}`,
    state: "funding",
    goalStroops: "10000000000",
    totalStroops: "2505000000",
    deadline: "2026-11-30T12:00:00.000Z"
  },
  contributions: [
    {
      transactionHash: HASH_B,
      investorAccountId: INVESTOR,
      amountStroops: "2505000000",
      observedAt: "2026-10-08T10:05:00.000Z",
      explorerUrl: null
    }
  ],
  distributions: [
    {
      distributionId: "88888888-8888-4888-8888-888888888888" as never,
      state: "confirmed",
      period: "2026-08",
      transactionHash: HASH_C,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${HASH_C}`,
      totalStroops: "150000000",
      recipientCount: 3,
      createdAt: "2026-09-01T09:00:00.000Z",
      confirmedAt: "2026-09-01T09:00:06.000Z",
      ledgerSequence: "123456",
      failureReason: null
    },
    {
      distributionId: "99999999-9999-4999-8999-999999999999" as never,
      state: "submitted",
      period: null,
      transactionHash: HASH_D,
      explorerUrl: null,
      totalStroops: "70000000",
      recipientCount: 1,
      createdAt: "2026-10-01T09:00:00.000Z",
      confirmedAt: null,
      ledgerSequence: null,
      failureReason: null
    }
  ],
  reconciliation: {
    status: "in_sync",
    lastReconciledAt: "2026-10-08T10:06:00.000Z",
    lastDivergedAt: null
  }
};

const EMPTY: AdminApplicationEvidence = {
  applicationId: APPLICATION_ID,
  applicationState: "human_review",
  smeReference: "sme-002",
  companyName: null,
  decision: null,
  deployment: null,
  vault: null,
  contributions: [],
  distributions: [],
  reconciliation: null
};

function step(steps: readonly AdminEvidenceStep[], id: AdminEvidenceStepId): AdminEvidenceStep {
  const found = steps.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing step ${id}`);
  return found;
}

function fact(target: { readonly facts: readonly { readonly term: string; readonly value: string }[] }, term: string) {
  return target.facts.find((candidate) => candidate.term === term)?.value;
}

describe("adminEvidencePath", () => {
  it("nests the evidence under the application's review route", () => {
    expect(adminEvidencePath(APPLICATION_ID)).toBe(`/admin/pymes/${APPLICATION_ID}/evidence`);
  });

  it("encodes the id", () => {
    expect(adminEvidencePath("a/b")).toBe("/admin/pymes/a%2Fb/evidence");
  });
});

describe("formatters", () => {
  it("renders stroops as XLM with the template's seven decimals", () => {
    expect(formatEvidenceXlm("2505000000")).toBe("250,5000000 XLM");
    expect(formatEvidenceXlm("0")).toBe("0,0000000 XLM");
  });

  it("renders a timestamp as a deterministic UTC date and time", () => {
    expect(formatEvidenceDateTime("2026-10-07T15:30:00.000Z")).toBe("07/10/2026 15:30 UTC");
  });
});

describe("buildAdminEvidenceChain", () => {
  it("orders the chain from the application to the reconciliation", () => {
    const chain = buildAdminEvidenceChain(FULL);
    expect(chain.steps.map((entry) => entry.id)).toEqual([
      "application",
      "decision",
      "deployment",
      "contributions",
      "distributions",
      "reconciliation"
    ]);
    expect(chain.steps.map((entry) => entry.title)).toEqual([
      "1 · Solicitud",
      "2 · Decisión humana",
      "3 · Despliegue de la bóveda",
      "4 · Aportes",
      "5 · Distribuciones",
      "6 · Reconciliación"
    ]);
  });

  it("builds the header from the company, reference and review state", () => {
    const chain = buildAdminEvidenceChain(FULL);
    expect(chain.header.title).toBe("Evidencia: Panadería Horizonte SRL");
    expect(chain.header.subline).toBe(`sme-001 · ${APPLICATION_ID}`);
    expect(chain.header.state.label).toBe("Aprobada");
    expect(chain.trustNote).toBe(EVIDENCE_COPY.trustNote);
  });

  it("maps the human decision with its actor, reason, limit and date", () => {
    const decision = step(buildAdminEvidenceChain(FULL).steps, "decision");
    expect(decision.status).toMatchObject({ label: "Aprobada", tone: "success" });
    expect(fact(decision, "Decidió")).toBe("Admin Vaqcrow");
    expect(fact(decision, "Razón")).toBe("Ventas consistentes y documentación completa.");
    expect(fact(decision, "Límite aprobado")).toBe("ARS 12.000.000");
    expect(fact(decision, "Fecha")).toBe("07/10/2026 15:30 UTC");
    expect(decision.note).toBe(EVIDENCE_COPY.humanDecisionNote);
  });

  it("shows the vault proofs with their explorer links", () => {
    const deployment = step(buildAdminEvidenceChain(FULL).steps, "deployment");
    expect(deployment.status).toMatchObject({ label: "Bóveda confirmada", tone: "success" });
    expect(deployment.proofs).toEqual([
      { label: "Contrato de la bóveda", value: CONTRACT, explorerUrl: FULL.vault?.vaultExplorerUrl },
      { label: "Hash del despliegue", value: HASH_A, explorerUrl: FULL.vault?.deployExplorerUrl }
    ]);
    expect(fact(deployment, "Estado de la bóveda")).toBe("Fondeo abierto");
    expect(fact(deployment, "Meta")).toBe("1.000,0000000 XLM");
    expect(fact(deployment, "Aportado")).toBe("250,5000000 XLM");
    expect(fact(deployment, "Plazo")).toBe("30/11/2026 12:00 UTC");
  });

  it("keeps a missing deploy hash as «Sin dato», never a zero or a link", () => {
    const evidence: AdminApplicationEvidence = {
      ...FULL,
      vault: { ...FULL.vault!, deployTransactionHash: null, deployExplorerUrl: null, vaultExplorerUrl: null }
    };
    const deployment = step(buildAdminEvidenceChain(evidence).steps, "deployment");
    expect(deployment.proofs).toEqual([
      { label: "Contrato de la bóveda", value: CONTRACT, explorerUrl: null },
      { label: "Hash del despliegue", value: null, explorerUrl: null }
    ]);
  });

  it("reads a recorded but unconfirmed deployment without claiming the vault", () => {
    const pending = step(
      buildAdminEvidenceChain({ ...FULL, deployment: { state: "deploying", campaignId: null }, vault: null }).steps,
      "deployment"
    );
    expect(pending.status).toMatchObject({ label: "Desplegando bóveda", tone: "info" });
    expect(pending.proofs).toEqual([]);
    expect(pending.facts).toEqual([]);

    const failed = step(
      buildAdminEvidenceChain({ ...FULL, deployment: { state: "failed", campaignId: null }, vault: null }).steps,
      "deployment"
    );
    expect(failed.status).toMatchObject({ label: "Despliegue fallido", tone: "critical" });
  });

  it("maps each contribution with the investor, amount, date and proof", () => {
    const contributions = step(buildAdminEvidenceChain(FULL).steps, "contributions");
    expect(contributions.status).toMatchObject({ label: "1 confirmado en el ledger", tone: "success" });
    expect(contributions.items).toHaveLength(1);
    const [item] = contributions.items!;
    expect(item!.heading).toBe("250,5000000 XLM");
    expect(item!.facts).toEqual([
      { term: "Inversor", value: INVESTOR, kind: "account" },
      { term: "Observado", value: "08/10/2026 10:05 UTC" }
    ]);
    expect(item!.proof).toEqual({ label: "Hash de la transacción", value: HASH_B, explorerUrl: null });
  });

  it("maps each distribution with its state copy, period and confirmation", () => {
    const distributions = step(buildAdminEvidenceChain(FULL).steps, "distributions");
    expect(distributions.status).toMatchObject({ label: "1 de 2 confirmadas", tone: "caution" });
    const [confirmed, submitted] = distributions.items!;
    expect(confirmed!.heading).toBe("Agosto 2026");
    expect(confirmed!.status).toMatchObject({ label: "Confirmada", tone: "success" });
    expect(fact(confirmed!, "Total")).toBe("15,0000000 XLM");
    expect(fact(confirmed!, "Destinatarios")).toBe("3");
    expect(fact(confirmed!, "Confirmada")).toBe("01/09/2026 09:00 UTC");
    expect(fact(confirmed!, "Ledger")).toBe("123456");
    expect(confirmed!.proof.explorerUrl).toBe(FULL.distributions[0]!.explorerUrl);

    expect(submitted!.heading).toBe("Sin período");
    expect(submitted!.status).toMatchObject({ label: "Enviada · pendiente de confirmación", tone: "caution" });
    expect(fact(submitted!, "Confirmada")).toBe("Pendiente de confirmación");
    expect(fact(submitted!, "Ledger")).toBe("Sin dato");
    expect(submitted!.proof).toEqual({ label: "Hash de la transacción", value: HASH_D, explorerUrl: null });
  });

  it("explains a failed distribution with the closed failure vocabulary", () => {
    const evidence: AdminApplicationEvidence = {
      ...FULL,
      distributions: [
        { ...FULL.distributions[1]!, state: "failed", failureReason: "insufficient_balance", period: "2026-09" }
      ]
    };
    const distributions = step(buildAdminEvidenceChain(evidence).steps, "distributions");
    const [failed] = distributions.items!;
    expect(failed!.status).toMatchObject({ label: "Fallida", tone: "critical" });
    expect(fact(failed!, "Motivo")).toBe("La cuenta de origen no alcanza a cubrir el monto más la comisión.");
    expect(fact(failed!, "Confirmada")).toBeUndefined();
  });

  it("states the stored reconciliation in words, with its dates", () => {
    const inSync = step(buildAdminEvidenceChain(FULL).steps, "reconciliation");
    expect(inSync.status).toMatchObject({ label: "Conciliado", tone: "success", icon: "check" });
    expect(fact(inSync, "Última conciliación")).toBe("08/10/2026 10:06 UTC");
    expect(fact(inSync, "Última divergencia")).toBe("Sin divergencias registradas");

    const diverged = step(
      buildAdminEvidenceChain({
        ...FULL,
        reconciliation: {
          status: "diverged",
          lastReconciledAt: "2026-10-08T10:06:00.000Z",
          lastDivergedAt: "2026-10-08T11:00:00.000Z"
        }
      }).steps,
      "reconciliation"
    );
    expect(diverged.status).toMatchObject({ label: "Divergente", tone: "critical", icon: "alert" });
    expect(fact(diverged, "Última divergencia")).toBe("08/10/2026 11:00 UTC");
  });

  it("renders an application with no chain yet as «Sin dato» and empty lists, never zeros", () => {
    const chain = buildAdminEvidenceChain(EMPTY);
    expect(chain.header.title).toBe("Evidencia: Sin dato");
    expect(chain.header.state.label).toBe("Pendiente de revisión");

    const application = step(chain.steps, "application");
    expect(fact(application, "Empresa")).toBe("Sin dato");

    for (const id of ["decision", "deployment", "reconciliation"] as const) {
      const entry = step(chain.steps, id);
      expect(entry.status.icon).toBe("missing");
      expect(entry.status.tone).toBe("neutral");
      expect(entry.facts).toEqual([]);
    }

    const contributions = step(chain.steps, "contributions");
    expect(contributions.items).toEqual([]);
    expect(contributions.empty).toEqual(EVIDENCE_COPY.contributionsEmpty);
    expect(contributions.status.label).toBe("Sin aportes confirmados");

    const distributions = step(chain.steps, "distributions");
    expect(distributions.items).toEqual([]);
    expect(distributions.empty).toEqual(EVIDENCE_COPY.distributionsEmpty);

    const serialized = JSON.stringify(chain);
    expect(serialized).not.toContain("0,0000000");
  });

  it("marks an approval without a limit as «Sin dato»", () => {
    const decision = step(
      buildAdminEvidenceChain({
        ...FULL,
        decision: { ...FULL.decision!, outcome: "changes_requested", approvedLimitArs: null }
      }).steps,
      "decision"
    );
    expect(decision.status).toMatchObject({ label: "Requiere cambios", tone: "info" });
    expect(fact(decision, "Límite aprobado")).toBe("Sin dato");
  });
});

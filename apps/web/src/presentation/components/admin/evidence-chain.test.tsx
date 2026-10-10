import { render, screen, within } from "@testing-library/react";
import type { AdminApplicationEvidence } from "@vaqcrow/contracts";
import { describe, expect, it } from "vitest";
import { buildAdminEvidenceChain } from "@/application/admin/evidence";
import { EvidenceChain } from "./evidence-chain";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222" as AdminApplicationEvidence["applicationId"];
const CAMPAIGN_ID = "77777777-7777-4777-8777-777777777777";
const CONTRACT = "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
const INVESTOR = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const HASH_CONTRIBUTION = "b".repeat(64);
const HASH_DISTRIBUTION = "c".repeat(64);
const VAULT_URL = `https://stellar.expert/explorer/testnet/contract/${CONTRACT}`;
const DISTRIBUTION_URL = `https://stellar.expert/explorer/testnet/tx/${HASH_DISTRIBUTION}`;

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
    vaultExplorerUrl: VAULT_URL,
    deployTransactionHash: null,
    deployExplorerUrl: null,
    state: "funding",
    goalStroops: "10000000000",
    totalStroops: "2505000000",
    deadline: "2026-11-30T12:00:00.000Z"
  },
  contributions: [
    {
      transactionHash: HASH_CONTRIBUTION,
      investorAccountId: INVESTOR,
      amountStroops: "2505000000",
      observedAt: "2026-10-08T10:05:00.000Z",
      explorerUrl: null
    }
  ],
  distributions: [
    {
      distributionId: "88888888-8888-4888-8888-888888888888" as never,
      state: "submitted",
      period: "2026-08",
      transactionHash: HASH_DISTRIBUTION,
      explorerUrl: DISTRIBUTION_URL,
      totalStroops: "150000000",
      recipientCount: 3,
      createdAt: "2026-09-01T09:00:00.000Z",
      confirmedAt: null,
      ledgerSequence: null,
      failureReason: null
    }
  ],
  reconciliation: { status: "diverged", lastReconciledAt: "2026-10-08T10:06:00.000Z", lastDivergedAt: null }
};

function stepNamed(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 2, name });
  const item = heading.closest("li");
  if (!item) throw new Error(`no step for ${name}`);
  return item;
}

describe("EvidenceChain", () => {
  it("renders the six steps as an ordered list, oldest first", () => {
    render(<EvidenceChain chain={buildAdminEvidenceChain(FULL)} />);
    const list = screen.getByRole("list", { name: "Cadena de evidencia" });
    expect(list.tagName).toBe("OL");
    const titles = within(list)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual([
      "1 · Solicitud",
      "2 · Decisión humana",
      "3 · Despliegue de la bóveda",
      "4 · Aportes",
      "5 · Distribuciones",
      "6 · Reconciliación"
    ]);
  });

  it("shows the human decision with its actor and the canonical note", () => {
    render(<EvidenceChain chain={buildAdminEvidenceChain(FULL)} />);
    const decision = stepNamed("2 · Decisión humana");
    expect(within(decision).getByText("Admin Vaqcrow")).toBeTruthy();
    expect(within(decision).getByText("ARS 12.000.000")).toBeTruthy();
    expect(
      within(decision).getByText("Esta decisión la registra una persona. La recomendación de IA no aprueba ni transfiere fondos.")
    ).toBeTruthy();
  });

  it("links the vault to the explorer in a new tab and keeps a missing deploy hash as «Sin dato»", () => {
    render(<EvidenceChain chain={buildAdminEvidenceChain(FULL)} />);
    const deployment = stepNamed("3 · Despliegue de la bóveda");
    const links = within(deployment).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toBe(VAULT_URL);
    expect(links[0]!.getAttribute("target")).toBe("_blank");
    expect(links[0]!.getAttribute("rel")).toBe("noreferrer noopener");
    expect(within(deployment).getByText("Sin dato")).toBeTruthy();
    expect(within(deployment).getByText("Evidencia faltante")).toBeTruthy();
  });

  it("gives the vault and deploy explorer links distinct accessible names", () => {
    const DEPLOY_HASH = "d".repeat(64);
    const DEPLOY_URL = `https://stellar.expert/explorer/testnet/tx/${DEPLOY_HASH}`;
    const withDeploy: AdminApplicationEvidence = {
      ...FULL,
      vault: { ...FULL.vault!, deployTransactionHash: DEPLOY_HASH, deployExplorerUrl: DEPLOY_URL }
    };
    render(<EvidenceChain chain={buildAdminEvidenceChain(withDeploy)} />);
    const deployment = stepNamed("3 · Despliegue de la bóveda");
    const names = within(deployment)
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label"));
    expect(names).toEqual([
      "Ver en el explorador: contrato de la bóveda (abre en una pestaña nueva)",
      "Ver en el explorador: transacción de despliegue de la bóveda (abre en una pestaña nueva)"
    ]);
  });

  it("lists contributions without a link when the explorer URL is null", () => {
    render(<EvidenceChain chain={buildAdminEvidenceChain(FULL)} />);
    const contributions = stepNamed("4 · Aportes");
    const rows = within(contributions).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByRole("heading", { level: 3, name: "250,5000000 XLM" })).toBeTruthy();
    expect(within(rows[0]!).queryByRole("link")).toBeNull();
    expect(within(rows[0]!).getByTitle(HASH_CONTRIBUTION)).toBeTruthy();
    expect(within(rows[0]!).getByTitle(INVESTOR)).toBeTruthy();
  });

  it("marks a sent distribution as pending confirmation and links its hash", () => {
    render(<EvidenceChain chain={buildAdminEvidenceChain(FULL)} />);
    const distributions = stepNamed("5 · Distribuciones");
    expect(within(distributions).getByText("Enviada · pendiente de confirmación")).toBeTruthy();
    const link = within(distributions).getByRole("link", {
      name: `Ver en el explorador: hash de la transacción ${HASH_DISTRIBUTION} (abre en una pestaña nueva)`
    });
    expect(link.getAttribute("href")).toBe(DISTRIBUTION_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer noopener");
  });

  it("states the reconciliation in words with an icon, never color alone", () => {
    render(<EvidenceChain chain={buildAdminEvidenceChain(FULL)} />);
    const reconciliation = stepNamed("6 · Reconciliación");
    const status = within(reconciliation).getByText("Divergente");
    expect(status.closest("[data-tone]")?.getAttribute("data-tone")).toBe("critical");
    expect(status.closest("[data-tone]")?.querySelector("svg[aria-hidden='true']")).toBeTruthy();
  });

  it("shows empty states for a chain with no contributions or distributions", () => {
    const empty: AdminApplicationEvidence = {
      ...FULL,
      applicationState: "human_review",
      companyName: null,
      decision: null,
      deployment: null,
      vault: null,
      contributions: [],
      distributions: [],
      reconciliation: null
    };
    render(<EvidenceChain chain={buildAdminEvidenceChain(empty)} />);
    expect(within(stepNamed("4 · Aportes")).getByText("Todavía no hay aportes confirmados")).toBeTruthy();
    expect(within(stepNamed("5 · Distribuciones")).getByText("Todavía no hay distribuciones")).toBeTruthy();
    expect(within(stepNamed("2 · Decisión humana")).getByText("Sin decisión registrada")).toBeTruthy();
    expect(within(stepNamed("6 · Reconciliación")).getByText("Sin conciliación registrada")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

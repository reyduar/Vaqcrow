import { render as rtlRender, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { failureReasonCopy } from "@/application/funding/failure-reason-copy";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { HumanDecisionGateway } from "@/application/ports/human-decision-gateway";
import type { RevenueShareDistributionGateway } from "@/application/ports/revenue-share-distribution-gateway";
import type {
  CampaignSnapshot,
  HumanDecisionRecord,
  RevenueShareDistributionSnapshot
} from "@vaqcrow/contracts";
import { JourneyStoreProvider } from "@/state/journey-store-provider";
import { EvidenceWorkspace } from "./evidence-workspace";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-4266141740ab";
const DISTRIBUTION_ID = "223e4567-e89b-42d3-a456-4266141740ab";
const SME = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const CONTRACT = "CDEMOCONTRACTV27EJOTY5CHMRW3AFKPUZ6DINSX4BGLQV27EJOTY5CH";

const actor = "Ana Revisora";

/** The journey once the request was submitted, before any movement ran. */
const render = (ui: ReactElement) =>
  rtlRender(<JourneyStoreProvider initial={{ applicationId: APPLICATION_ID }}>{ui}</JourneyStoreProvider>);

/** The journey after funding and distribution ran: what a shared evidence link hydrates. */
const renderRun = (ui: ReactElement) =>
  rtlRender(
    <JourneyStoreProvider
      initial={{ applicationId: APPLICATION_ID, campaignId: CAMPAIGN_ID, distributionId: DISTRIBUTION_ID }}
    >
      {ui}
    </JourneyStoreProvider>
  );
const failureCopy = failureReasonCopy("insufficient_balance");

function decision(overrides: Record<string, unknown> = {}): HumanDecisionRecord {
  return {
    decisionId: "11111111-1111-4111-8111-111111111111",
    applicationId: APPLICATION_ID,
    outcome: "approved",
    actor,
    reason: "Cumple las condiciones del demo.",
    approvedLimitArs: 1_000_000,
    decidedAt: "2026-09-19T12:00:00.000Z",
    correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ...overrides
  } as unknown as HumanDecisionRecord;
}

function campaign(overrides: Record<string, unknown> = {}): CampaignSnapshot {
  return {
    campaignId: CAMPAIGN_ID,
    applicationId: APPLICATION_ID,
    contractAddress: CONTRACT,
    network: "testnet",
    state: "funding",
    goalStroops: 50_000_000n,
    totalStroops: 15_000_000n,
    deadline: "2026-12-01T00:00:00.000Z",
    smeAccountId: SME,
    investorContributionStroops: 5_000_000n,
    reconciliationStatus: "in_sync",
    explorerUrl: "https://stellar.expert/explorer/testnet/contract/CDEMO",
    ...overrides
  } as unknown as CampaignSnapshot;
}

function distribution(overrides: Record<string, unknown> = {}): RevenueShareDistributionSnapshot {
  return {
    distributionId: DISTRIBUTION_ID,
    network: "testnet",
    networkPassphrase: "passphrase-from-the-response",
    sourceAccountId: SME,
    sourceSequence: "1234567891",
    memo: null,
    expiresAt: "2026-09-21T12:15:00.000Z",
    recipients: [{ accountId: SME, amountStroops: 13_500_000n }],
    state: "confirmed",
    transactionHash: "TRANSACTION-HASH",
    applicationId: APPLICATION_ID,
    explorerUrl: "https://stellar.expert/explorer/testnet/tx/TRANSACTION-HASH",
    failureReason: null,
    lastCorrelationId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-09-21T12:00:00.000Z",
    updatedAt: "2026-09-21T12:00:05.000Z",
    ...overrides
  } as unknown as RevenueShareDistributionSnapshot;
}

function createHumanDecisionGateway(
  overrides: Partial<HumanDecisionGateway> = {}
): HumanDecisionGateway {
  return {
    record: vi.fn(),
    readLatest: vi.fn().mockResolvedValue(decision()),
    ...overrides
  } as unknown as HumanDecisionGateway;
}

function createCampaignGateway(overrides: Partial<CampaignGateway> = {}): CampaignGateway {
  return {
    openCampaign: vi.fn(),
    getCampaign: vi.fn().mockResolvedValue(campaign()),
    prepareInvocation: vi.fn(),
    submitInvocation: vi.fn(),
    getTransaction: vi.fn(),
    ...overrides
  } as unknown as CampaignGateway;
}

function createDistributionGateway(
  overrides: Partial<RevenueShareDistributionGateway> = {}
): RevenueShareDistributionGateway {
  return {
    prepare: vi.fn(),
    submit: vi.fn(),
    getStatus: vi.fn().mockResolvedValue({ ok: true, value: distribution() }),
    ...overrides
  } as unknown as RevenueShareDistributionGateway;
}

describe("EvidenceWorkspace", () => {
  it("renders complete evidence: the recorded decision, the vault and the confirmed distribution", async () => {
    renderRun(
      <EvidenceWorkspace
        humanDecisionGateway={createHumanDecisionGateway()}
        campaignGateway={createCampaignGateway()}
        distributionGateway={createDistributionGateway()}
      />
    );

    expect(await screen.findByText(actor)).toBeInTheDocument();
    expect(screen.getByText("Fondeo abierto")).toBeInTheDocument();
    expect(screen.getByText("Confirmada en el ledger")).toBeInTheDocument();
    expect(screen.getByText("TRANSACTION-HASH")).toBeInTheDocument();
  });

  it("keeps a pending distribution pending, never confirmed", async () => {
    renderRun(
      <EvidenceWorkspace
        humanDecisionGateway={createHumanDecisionGateway()}
        campaignGateway={createCampaignGateway()}
        distributionGateway={createDistributionGateway({
          getStatus: vi.fn().mockResolvedValue({
            ok: true,
            value: distribution({ state: "submitted" })
          })
        })}
      />
    );

    expect(await screen.findByText("Enviada · pendiente de confirmación")).toBeInTheDocument();
    expect(screen.queryByText(/Confirmada en el ledger/i)).not.toBeInTheDocument();
  });

  it("renders a failed distribution with its own failure reason and no success wording", async () => {
    renderRun(
      <EvidenceWorkspace
        humanDecisionGateway={createHumanDecisionGateway()}
        campaignGateway={createCampaignGateway()}
        distributionGateway={createDistributionGateway({
          getStatus: vi.fn().mockResolvedValue({
            ok: true,
            value: distribution({ state: "failed", failureReason: "insufficient_balance" })
          })
        })}
      />
    );

    expect(await screen.findByText("Fallida")).toBeInTheDocument();
    expect(screen.getByText(failureCopy)).toBeInTheDocument();
    expect(screen.queryByText(/Confirmada en el ledger/i)).not.toBeInTheDocument();
  });

  it("declares absent the sources whose ids are missing, without calling their gateways", async () => {
    const campaignGateway = createCampaignGateway();
    const distributionGateway = createDistributionGateway();

    render(
      <EvidenceWorkspace
        humanDecisionGateway={createHumanDecisionGateway()}
        campaignGateway={campaignGateway}
        distributionGateway={distributionGateway}
      />
    );

    expect(await screen.findAllByText("Ausente")).toHaveLength(2);
    expect(campaignGateway.getCampaign).not.toHaveBeenCalled();
    expect(distributionGateway.getStatus).not.toHaveBeenCalled();
    // The decision was still readable, and an absence never borrows its facts.
    expect(screen.getByText(actor)).toBeInTheDocument();
  });

  it("treats the distribution read's not_found as an absence, not as an empty success", async () => {
    renderRun(
      <EvidenceWorkspace
        humanDecisionGateway={createHumanDecisionGateway()}
        campaignGateway={createCampaignGateway()}
        distributionGateway={createDistributionGateway({
          getStatus: vi.fn().mockResolvedValue({ ok: false, error: { kind: "not_found" } })
        })}
      />
    );

    expect(await screen.findByText("Fondeo abierto")).toBeInTheDocument();
    expect(screen.getAllByText("Ausente")).toHaveLength(1);
    expect(screen.queryByText(/Confirmada en el ledger/i)).not.toBeInTheDocument();
  });

  it("renders a rejected read as unavailable and never as observed", async () => {
    renderRun(
      <EvidenceWorkspace
        humanDecisionGateway={createHumanDecisionGateway({
          readLatest: vi.fn().mockRejectedValue(new HttpClientError("http", 503))
        })}
        campaignGateway={createCampaignGateway({
          getCampaign: vi.fn().mockRejectedValue(new HttpClientError("network"))
        })}
        distributionGateway={createDistributionGateway({
          getStatus: vi.fn().mockResolvedValue({ ok: false, error: { kind: "unavailable" } })
        })}
      />
    );

    expect(await screen.findAllByText("No disponible")).toHaveLength(3);
    expect(screen.queryByText(actor)).not.toBeInTheDocument();
    expect(screen.queryByText("Fondeo abierto")).not.toBeInTheDocument();
  });

  it("reads the decision of the journey application, not a fixed demo one", async () => {
    const humanDecisionGateway = createHumanDecisionGateway();

    render(
      <EvidenceWorkspace
        humanDecisionGateway={humanDecisionGateway}
        campaignGateway={createCampaignGateway()}
        distributionGateway={createDistributionGateway()}
      />
    );

    await screen.findByText(actor);
    expect(humanDecisionGateway.readLatest).toHaveBeenCalledWith(APPLICATION_ID);
  });

  it("asks for the request first, and reads nothing, when the journey has no application", () => {
    const humanDecisionGateway = createHumanDecisionGateway();
    const campaignGateway = createCampaignGateway();
    const distributionGateway = createDistributionGateway();

    rtlRender(
      <JourneyStoreProvider>
        <EvidenceWorkspace
          humanDecisionGateway={humanDecisionGateway}
          campaignGateway={campaignGateway}
          distributionGateway={distributionGateway}
        />
      </JourneyStoreProvider>
    );

    expect(screen.getByRole("status")).toHaveTextContent(/primero hay que enviar la solicitud/i);
    expect(screen.getByRole("link", { name: "Ir a la solicitud" })).toHaveAttribute("href", "/request");
    expect(humanDecisionGateway.readLatest).not.toHaveBeenCalled();
    expect(campaignGateway.getCampaign).not.toHaveBeenCalled();
    expect(distributionGateway.getStatus).not.toHaveBeenCalled();
  });

  it("shows a loading state while the sources are being read", () => {
    render(
      <EvidenceWorkspace
        humanDecisionGateway={createHumanDecisionGateway({
          readLatest: vi.fn().mockReturnValue(new Promise(() => {}))
        })}
        campaignGateway={createCampaignGateway()}
        distributionGateway={createDistributionGateway()}
      />
    );

    expect(screen.getByText("Cargando la evidencia…")).toBeInTheDocument();
  });

  it("renders the synthetic case, an unavailable decision and two absent movements without a configured backend", async () => {
    // No base URL means every env-configured gateway is null; the workspace must
    // still produce a total answer rather than an empty or endless loading one.
    render(
      <EvidenceWorkspace
        humanDecisionGateway={null}
        campaignGateway={null}
        distributionGateway={null}
      />
    );

    const synthetic = (await screen.findByText("Caso simulado")).closest("li");
    expect(synthetic).toHaveAttribute("data-state", "observed");
    expect(within(synthetic as HTMLElement).getByText("SIMULADO")).toBeInTheDocument();

    // The decision read was attempted against no backend: that is "cannot read",
    // and the fallback must never present it as the absence of a decision.
    const decisionEntry = screen.getByText("Decisión humana").closest("li");
    expect(decisionEntry).toHaveAttribute("data-state", "unavailable");
    expect(within(decisionEntry as HTMLElement).getByText("No disponible")).toBeInTheDocument();
    expect(within(decisionEntry as HTMLElement).queryByText("Ausente")).not.toBeInTheDocument();

    // A missing id means the movement was not run in this session — an absence,
    // not a source that could not be read.
    for (const title of ["Bóveda de campaña", "Distribución de ingresos"]) {
      const movement = screen.getByText(title).closest("li");
      expect(movement).toHaveAttribute("data-state", "absent");
      expect(within(movement as HTMLElement).getByText("Ausente")).toBeInTheDocument();
    }

    expect(screen.queryByText("Cargando la evidencia…")).not.toBeInTheDocument();
    // Nothing was read, so nothing may claim the movement succeeded.
    expect(screen.queryByText(/Confirmada en el ledger/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Aprobada")).not.toBeInTheDocument();
  });

  it("reports both movements as unavailable, never as not run, when the backend is unconfigured but both ids are present", async () => {
    // An id proves the step ran, so an unconfigured backend must surface as
    // "cannot read" — reporting it as absent would deny a run that happened.
    renderRun(
      <EvidenceWorkspace
        humanDecisionGateway={null}
        campaignGateway={null}
        distributionGateway={null}
      />
    );

    await screen.findByText("Caso simulado");

    expect(screen.getAllByText("No disponible")).toHaveLength(3);
    expect(screen.queryByText("Ausente")).not.toBeInTheDocument();
  });

  it("keeps the null-gateway path total: it renders without throwing and has no gateway to call", async () => {
    // With `null` gateways there is no callable object at all, so the only
    // remaining failure mode is a throw; the fallback must stay total.
    expect(() =>
      render(
        <EvidenceWorkspace
          humanDecisionGateway={null}
          campaignGateway={null}
          distributionGateway={null}
        />
      )
    ).not.toThrow();

    expect(await screen.findByText("Caso simulado")).toBeInTheDocument();
  });
});

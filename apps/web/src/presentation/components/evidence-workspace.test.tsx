import { render, screen } from "@testing-library/react";
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
import { EvidenceWorkspace } from "./evidence-workspace";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-4266141740ab";
const DISTRIBUTION_ID = "223e4567-e89b-42d3-a456-4266141740ab";
const SME = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const CONTRACT = "CDEMOCONTRACTV27EJOTY5CHMRW3AFKPUZ6DINSX4BGLQV27EJOTY5CH";

const actor = "Ana Revisora";
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
    render(
      <EvidenceWorkspace
        campaignId={CAMPAIGN_ID}
        distributionId={DISTRIBUTION_ID}
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
    render(
      <EvidenceWorkspace
        campaignId={CAMPAIGN_ID}
        distributionId={DISTRIBUTION_ID}
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
    render(
      <EvidenceWorkspace
        campaignId={CAMPAIGN_ID}
        distributionId={DISTRIBUTION_ID}
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
        campaignId={null}
        distributionId={null}
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
    render(
      <EvidenceWorkspace
        campaignId={CAMPAIGN_ID}
        distributionId={DISTRIBUTION_ID}
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
    render(
      <EvidenceWorkspace
        campaignId={CAMPAIGN_ID}
        distributionId={DISTRIBUTION_ID}
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
});

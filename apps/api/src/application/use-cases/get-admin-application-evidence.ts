import { parseRevenueShareDistributionId, parseStellarFailureReason } from "@vaqcrow/contracts";
import type {
  AdminEvidenceContribution,
  AdminEvidenceDistribution,
  AdminEvidenceVault,
  ApplicationId,
  CampaignState as ContractCampaignState
} from "@vaqcrow/contracts";
import { contractExplorerUrl, transactionExplorerUrl } from "../explorer-url.js";
import type { AdminApplicationEvidenceResult } from "../ports/admin-application-evidence-port.js";
import type { ApplicationReviewRepositoryPort } from "../ports/application-review-repository-port.js";
import type { BusinessRepositoryPort } from "../ports/business-repository-port.js";
import type { CampaignDeploymentRepositoryPort } from "../ports/campaign-deployment-repository-port.js";
import type {
  CampaignContributionTransactionReadPort,
  CampaignRecord,
  CampaignRepositoryPort,
  CampaignState,
  ObservedContributionTransaction
} from "../ports/campaign-repository-port.js";
import type {
  RevenueShareDistributionCampaignReadPort,
  RevenueShareDistributionRecord
} from "../ports/revenue-share-distribution-repository-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";

export interface GetAdminApplicationEvidenceDependencies {
  readonly applicationReviews: Pick<ApplicationReviewRepositoryPort, "findById" | "readLatestHumanDecision">;
  readonly smeRequests: Pick<SmeRequestRepositoryPort, "findByApplicationId">;
  readonly businesses: Pick<BusinessRepositoryPort, "findByOwner">;
  readonly deployments: Pick<CampaignDeploymentRepositoryPort, "findByApplicationId">;
  /** The stored mirror only: this read never calls the chain. */
  readonly campaigns: Pick<CampaignRepositoryPort, "findByApplicationId">;
  readonly contributionTransactions: CampaignContributionTransactionReadPort;
  readonly distributions: RevenueShareDistributionCampaignReadPort;
  /** `StellarConfig.explorerUrl`; `undefined` on the `local` network, which turns every link into `null`. */
  readonly explorerBaseUrl: string | undefined;
}

const UNAVAILABLE: AdminApplicationEvidenceResult = { ok: false, error: { code: "unavailable" } };
const NOT_FOUND: AdminApplicationEvidenceResult = { ok: false, error: { code: "not_found" } };

/** The mirror stores the vault's raw state; the contract speaks the portfolio vocabulary. */
const CONTRACT_STATE: Readonly<Record<CampaignState, ContractCampaignState>> = {
  open: "funding",
  settled: "settled",
  refundable: "refunding"
};

/**
 * The ADMIN per-application Testnet evidence chain (#438/WU2).
 *
 * Read-only and chain-free: every fact is what the API already persisted —
 * the decision, the deployment row, the campaign mirror with its stored
 * reconciliation, the confirmed contribution transactions and the
 * distributions. An application that never reached a decision or a campaign
 * is still evidence (nulls and empty lists); only a missing application is
 * `not_found`, and any failed read makes the whole answer `unavailable`
 * rather than silently dropping part of the chain.
 */
export async function getAdminApplicationEvidence(
  dependencies: GetAdminApplicationEvidenceDependencies,
  input: { readonly applicationId: ApplicationId }
): Promise<AdminApplicationEvidenceResult> {
  try {
    const review = await dependencies.applicationReviews.findById(input.applicationId);
    if (!review.ok) return review.error.code === "not_found" ? NOT_FOUND : UNAVAILABLE;

    const smeRequest = await dependencies.smeRequests.findByApplicationId(input.applicationId);
    if (!smeRequest.ok) return smeRequest.error.code === "not_found" ? NOT_FOUND : UNAVAILABLE;

    const ownerUserId = smeRequest.value.ownerUserId;
    const [company, decision, deployment, campaign] = await Promise.all([
      // A legacy request without an owner cannot be attributed to a company.
      ownerUserId === undefined ? undefined : dependencies.businesses.findByOwner(ownerUserId),
      dependencies.applicationReviews.readLatestHumanDecision(input.applicationId),
      dependencies.deployments.findByApplicationId(input.applicationId),
      dependencies.campaigns.findByApplicationId(input.applicationId)
    ]);

    if (company !== undefined && !company.ok && company.error.code !== "not_found") return UNAVAILABLE;
    if (!decision.ok && decision.error.code !== "not_found") return UNAVAILABLE;
    if (!deployment.ok && deployment.error.code !== "not_found") return UNAVAILABLE;
    if (!campaign.ok && campaign.error.code !== "not_found") return UNAVAILABLE;

    let contributions: readonly ObservedContributionTransaction[] = [];
    let distributions: readonly RevenueShareDistributionRecord[] = [];
    if (campaign.ok) {
      const [contributionRead, distributionRead] = await Promise.all([
        dependencies.contributionTransactions.listObservedContributionTransactions(campaign.value.campaignId),
        dependencies.distributions.listByCampaign(campaign.value.campaignId)
      ]);
      if (!contributionRead.ok || !distributionRead.ok) return UNAVAILABLE;
      contributions = contributionRead.value;
      distributions = distributionRead.value;
    }

    const txUrl = (hash: string): string | null =>
      dependencies.explorerBaseUrl === undefined ? null : transactionExplorerUrl(dependencies.explorerBaseUrl, hash);

    return {
      ok: true,
      value: {
        applicationId: review.value.applicationId,
        applicationState: review.value.state,
        smeReference: smeRequest.value.request.smeReference,
        companyName: company?.ok ? company.value.name : null,
        decision: decision.ok
          ? {
              actor: decision.value.actor,
              outcome: decision.value.outcome,
              reason: decision.value.reason,
              approvedLimitArs: decision.value.approvedLimitArs,
              decidedAt: decision.value.decidedAt
            }
          : null,
        deployment: deployment.ok
          ? { state: deployment.value.state, campaignId: deployment.value.campaignId ?? null }
          : null,
        vault: campaign.ok ? toVault(campaign.value, dependencies.explorerBaseUrl, txUrl) : null,
        contributions: contributions.map((row) => toContribution(row, txUrl)),
        distributions: distributions.map((row) => toDistribution(row, txUrl)),
        reconciliation: campaign.ok
          ? {
              status: campaign.value.reconciliationStatus,
              lastReconciledAt: campaign.value.lastReconciledAt,
              lastDivergedAt: campaign.value.lastDivergedAt ?? null
            }
          : null
      }
    };
  } catch {
    return UNAVAILABLE;
  }
}

function toVault(
  campaign: CampaignRecord,
  explorerBaseUrl: string | undefined,
  txUrl: (hash: string) => string | null
): AdminEvidenceVault {
  const deployHash = campaign.deployTransactionHash ?? null;
  return {
    campaignId: campaign.campaignId,
    contractAddress: campaign.contractAddress,
    vaultExplorerUrl: explorerBaseUrl === undefined ? null : contractExplorerUrl(explorerBaseUrl, campaign.contractAddress),
    deployTransactionHash: deployHash,
    deployExplorerUrl: deployHash === null ? null : txUrl(deployHash),
    state: CONTRACT_STATE[campaign.state],
    goalStroops: campaign.goalStroops.toString(),
    totalStroops: campaign.totalStroops.toString(),
    deadline: campaign.deadline
  };
}

function toContribution(
  row: ObservedContributionTransaction,
  txUrl: (hash: string) => string | null
): AdminEvidenceContribution {
  return {
    transactionHash: row.transactionHash,
    investorAccountId: row.investorAccountId,
    amountStroops: row.amountStroops.toString(),
    observedAt: row.observedAt,
    explorerUrl: txUrl(row.transactionHash)
  };
}

function toDistribution(
  row: RevenueShareDistributionRecord,
  txUrl: (hash: string) => string | null
): AdminEvidenceDistribution {
  const total = row.recipients.reduce((sum, recipient) => sum + recipient.amountStroops, 0n);
  return {
    distributionId: parseRevenueShareDistributionId(row.distributionId),
    state: row.state,
    period: row.period ?? null,
    transactionHash: row.transactionHash,
    explorerUrl: txUrl(row.transactionHash),
    totalStroops: total.toString(),
    recipientCount: row.recipients.length,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt ?? null,
    ledgerSequence: row.ledgerSequence ?? null,
    failureReason: row.failureReason === undefined ? null : parseStellarFailureReason(row.failureReason)
  };
}

import { parseAdminApplicationEvidence, parseApplicationId, parseHumanDecisionRecord } from "@vaqcrow/contracts";
import type { ApplicationReviewSnapshot } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { BusinessRecord } from "../ports/business-repository-port.js";
import type { CampaignDeploymentRecord } from "../ports/campaign-deployment-repository-port.js";
import type { CampaignRecord, ObservedContributionTransaction } from "../ports/campaign-repository-port.js";
import type { RevenueShareDistributionRecord } from "../ports/revenue-share-distribution-repository-port.js";
import type { SmeRequestRecord } from "../ports/sme-request-repository-port.js";
import { getAdminApplicationEvidence } from "./get-admin-application-evidence.js";
import type { GetAdminApplicationEvidenceDependencies } from "./get-admin-application-evidence.js";

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const CAMPAIGN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CORRELATION_ID = "77777777-7777-4777-8777-777777777777";
const EXPLORER = "https://stellar.expert/explorer/testnet";
const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const SME_ACCOUNT = `G${"S".repeat(55)}`;
const INVESTOR = `G${"A".repeat(55)}`;
const OTHER_INVESTOR = `G${"B".repeat(55)}`;
const DEPLOY_HASH = "b".repeat(64);
const CONTRIBUTION_HASH = "c".repeat(64);
const DISTRIBUTION_HASH = "d".repeat(64);
const FAILED_DISTRIBUTION_HASH = "e".repeat(64);

const REVIEW: ApplicationReviewSnapshot = { applicationId: APPLICATION_ID, state: "approved" };
const SME_REQUEST: SmeRequestRecord = {
  applicationId: APPLICATION_ID,
  ownerUserId: OWNER_ID,
  request: {
    smeReference: "sme-001",
    declaredTotalArs: 1_500_000,
    periodStart: "2026-01",
    periodEnd: "2026-06",
    simuladoLabel: "SIMULADO"
  }
};
const COMPANY: BusinessRecord = {
  businessId: "44444444-4444-4444-8444-444444444444",
  ownerUserId: OWNER_ID,
  name: "Almacén Demo",
  cuit: "20-12345678-9",
  sector: "Comercio",
  city: "Rosario",
  description: "Empresa sintética",
  goalArs: 2_000_000,
  revenueShare: 8,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z"
};
const DECISION = parseHumanDecisionRecord({
  decisionId: "66666666-6666-4666-8666-666666666666",
  applicationId: APPLICATION_ID,
  outcome: "approved",
  actor: "Admin Vaqcrow",
  reason: "La documentación es consistente.",
  approvedLimitArs: 1_500_000,
  decidedAt: "2026-09-01T12:03:00.000Z",
  correlationId: CORRELATION_ID
});
const DEPLOYMENT: CampaignDeploymentRecord = {
  applicationId: APPLICATION_ID,
  state: "confirmed",
  attempts: 1,
  campaignId: CAMPAIGN_ID,
  lastCorrelationId: DECISION.correlationId,
  createdAt: "2026-09-01T12:03:01.000Z",
  updatedAt: "2026-09-01T12:04:00.000Z"
};
const CAMPAIGN: CampaignRecord = {
  campaignId: CAMPAIGN_ID,
  applicationId: APPLICATION_ID,
  smeAccountId: SME_ACCOUNT,
  contractAddress: VAULT,
  network: "testnet",
  tokenContractAddress: `C${"T".repeat(55)}`,
  goalStroops: 100_000_000n,
  deadline: "2026-12-01T00:00:00.000Z",
  state: "settled",
  totalStroops: 100_000_000n,
  reconciliationStatus: "diverged",
  lastReconciledAt: "2026-10-02T12:00:00.000Z",
  lastDivergedAt: "2026-10-02T11:00:00.000Z",
  deployTransactionHash: DEPLOY_HASH,
  createdAt: "2026-09-01T12:04:00.000Z",
  updatedAt: "2026-10-02T12:00:00.000Z"
};
const CONTRIBUTION: ObservedContributionTransaction = {
  transactionHash: CONTRIBUTION_HASH,
  campaignId: CAMPAIGN_ID,
  investorAccountId: INVESTOR,
  amountStroops: 100_000_000n,
  observedAt: "2026-10-01T12:00:00.000Z"
};
const DISTRIBUTION_BASE = {
  network: "testnet",
  networkPassphrase: "synthetic-passphrase",
  sourceAccountId: SME_ACCOUNT,
  sourceSequence: "1099511627778",
  expiresAt: "2026-10-03T12:15:00.000Z",
  signedXdr: "AAAA-synthetic",
  applicationId: APPLICATION_ID,
  campaignId: CAMPAIGN_ID,
  lastCorrelationId: DECISION.correlationId,
  confirmationAttempts: 1,
  nextAttemptAt: "2026-10-03T12:00:30.000Z",
  createdAt: "2026-10-03T12:00:00.000Z",
  updatedAt: "2026-10-03T12:00:10.000Z"
} as const;
const CONFIRMED_DISTRIBUTION: RevenueShareDistributionRecord = {
  ...DISTRIBUTION_BASE,
  distributionId: "88888888-8888-4888-8888-888888888888",
  period: "2026-09",
  transactionHash: DISTRIBUTION_HASH,
  recipients: [
    { accountId: INVESTOR, amountStroops: 10_000_000n },
    { accountId: OTHER_INVESTOR, amountStroops: 2_500_000n }
  ],
  state: "confirmed",
  confirmedAt: "2026-10-03T12:00:10.000Z",
  ledgerSequence: "1234567"
};
const FAILED_DISTRIBUTION: RevenueShareDistributionRecord = {
  ...DISTRIBUTION_BASE,
  distributionId: "99999999-9999-4999-8999-999999999999",
  transactionHash: FAILED_DISTRIBUTION_HASH,
  recipients: [{ accountId: INVESTOR, amountStroops: 1_000n }],
  state: "failed",
  failureReason: "unsuccessful"
};

/** A copy of `value` without `key`, modelling a row whose optional column is absent. */
function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  Reflect.deleteProperty(copy, key);
  return copy;
}

const NOT_FOUND = { ok: false, error: { code: "not_found" } } as const;
const UNAVAILABLE = { ok: false, error: { code: "unavailable" } } as const;

function dependencies(overrides: Partial<Record<string, unknown>> = {}): GetAdminApplicationEvidenceDependencies {
  // An explicit `explorerBaseUrl: undefined` models the `local` network.
  const explorerBaseUrl = "explorerBaseUrl" in overrides ? (overrides["explorerBaseUrl"] as string | undefined) : EXPLORER;
  return {
    applicationReviews: {
      findById: vi.fn().mockResolvedValue({ ok: true, value: REVIEW }),
      readLatestHumanDecision: vi.fn().mockResolvedValue(overrides["decision"] ?? { ok: true, value: DECISION })
    },
    smeRequests: {
      findByApplicationId: vi.fn().mockResolvedValue(overrides["smeRequest"] ?? { ok: true, value: SME_REQUEST })
    },
    businesses: { findByOwner: vi.fn().mockResolvedValue(overrides["company"] ?? { ok: true, value: COMPANY }) },
    deployments: {
      findByApplicationId: vi.fn().mockResolvedValue(overrides["deployment"] ?? { ok: true, value: DEPLOYMENT })
    },
    campaigns: {
      findByApplicationId: vi.fn().mockResolvedValue(overrides["campaign"] ?? { ok: true, value: CAMPAIGN })
    },
    contributionTransactions: {
      listObservedContributionTransactions: vi
        .fn()
        .mockResolvedValue(overrides["contributions"] ?? { ok: true, value: [CONTRIBUTION] })
    },
    distributions: {
      listByCampaign: vi
        .fn()
        .mockResolvedValue(overrides["distributions"] ?? { ok: true, value: [CONFIRMED_DISTRIBUTION, FAILED_DISTRIBUTION] })
    },
    explorerBaseUrl,
    ...(overrides["applicationReviews"] ? { applicationReviews: overrides["applicationReviews"] } : {})
  } as GetAdminApplicationEvidenceDependencies;
}

describe("getAdminApplicationEvidence", () => {
  it("assembles the full Testnet evidence chain with API-built explorer links", async () => {
    const deps = dependencies();

    const result = await getAdminApplicationEvidence(deps, { applicationId: APPLICATION_ID });

    expect(result).toEqual({
      ok: true,
      value: {
        applicationId: APPLICATION_ID,
        applicationState: "approved",
        smeReference: "sme-001",
        companyName: "Almacén Demo",
        decision: {
          actor: "Admin Vaqcrow",
          outcome: "approved",
          reason: "La documentación es consistente.",
          approvedLimitArs: 1_500_000,
          decidedAt: "2026-09-01T12:03:00.000Z"
        },
        deployment: { state: "confirmed", campaignId: CAMPAIGN_ID },
        vault: {
          campaignId: CAMPAIGN_ID,
          contractAddress: VAULT,
          vaultExplorerUrl: `${EXPLORER}/contract/${VAULT}`,
          deployTransactionHash: DEPLOY_HASH,
          deployExplorerUrl: `${EXPLORER}/tx/${DEPLOY_HASH}`,
          state: "settled",
          goalStroops: "100000000",
          totalStroops: "100000000",
          deadline: "2026-12-01T00:00:00.000Z"
        },
        contributions: [
          {
            transactionHash: CONTRIBUTION_HASH,
            investorAccountId: INVESTOR,
            amountStroops: "100000000",
            observedAt: "2026-10-01T12:00:00.000Z",
            explorerUrl: `${EXPLORER}/tx/${CONTRIBUTION_HASH}`
          }
        ],
        distributions: [
          {
            distributionId: CONFIRMED_DISTRIBUTION.distributionId,
            state: "confirmed",
            period: "2026-09",
            transactionHash: DISTRIBUTION_HASH,
            explorerUrl: `${EXPLORER}/tx/${DISTRIBUTION_HASH}`,
            totalStroops: "12500000",
            recipientCount: 2,
            createdAt: "2026-10-03T12:00:00.000Z",
            confirmedAt: "2026-10-03T12:00:10.000Z",
            ledgerSequence: "1234567",
            failureReason: null
          },
          {
            distributionId: FAILED_DISTRIBUTION.distributionId,
            state: "failed",
            period: null,
            transactionHash: FAILED_DISTRIBUTION_HASH,
            explorerUrl: `${EXPLORER}/tx/${FAILED_DISTRIBUTION_HASH}`,
            totalStroops: "1000",
            recipientCount: 1,
            createdAt: "2026-10-03T12:00:00.000Z",
            confirmedAt: null,
            ledgerSequence: null,
            failureReason: "unsuccessful"
          }
        ],
        reconciliation: {
          status: "diverged",
          lastReconciledAt: "2026-10-02T12:00:00.000Z",
          lastDivergedAt: "2026-10-02T11:00:00.000Z"
        }
      }
    });
    // The aggregate satisfies the wire contract the web parses.
    expect(() => parseAdminApplicationEvidence(result.ok ? result.value : undefined)).not.toThrow();
    // Contributions and distributions are read for the application's own campaign.
    expect(deps.contributionTransactions.listObservedContributionTransactions).toHaveBeenCalledWith(CAMPAIGN_ID);
    expect(deps.distributions.listByCampaign).toHaveBeenCalledWith(CAMPAIGN_ID);
  });

  it("maps the mirror's campaign states onto the contract vocabulary", async () => {
    for (const [stored, wire] of [
      ["open", "funding"],
      ["settled", "settled"],
      ["refundable", "refunding"]
    ] as const) {
      const result = await getAdminApplicationEvidence(
        dependencies({ campaign: { ok: true, value: { ...CAMPAIGN, state: stored } } }),
        { applicationId: APPLICATION_ID }
      );
      expect(result.ok && result.value.vault?.state).toBe(wire);
    }
  });

  it("returns null explorer links when the explorer base is undefined (local network)", async () => {
    const result = await getAdminApplicationEvidence(dependencies({ explorerBaseUrl: undefined }), { applicationId: APPLICATION_ID });

    if (!result.ok) throw new Error("expected evidence");
    expect(result.value.vault?.vaultExplorerUrl).toBeNull();
    expect(result.value.vault?.deployExplorerUrl).toBeNull();
    expect(result.value.vault?.deployTransactionHash).toBe(DEPLOY_HASH);
    expect(result.value.contributions.map((c) => c.explorerUrl)).toEqual([null]);
    expect(result.value.distributions.map((d) => d.explorerUrl)).toEqual([null, null]);
  });

  it("reports a missing deploy hash (pre-WU1 or adopted vault) as null, never a made-up link", async () => {
    const withoutHash = without(CAMPAIGN, "deployTransactionHash");
    const result = await getAdminApplicationEvidence(
      dependencies({ campaign: { ok: true, value: withoutHash }, contributions: { ok: true, value: [] } }),
      { applicationId: APPLICATION_ID }
    );

    if (!result.ok) throw new Error("expected evidence");
    expect(result.value.vault?.deployTransactionHash).toBeNull();
    expect(result.value.vault?.deployExplorerUrl).toBeNull();
    expect(result.value.vault?.vaultExplorerUrl).toBe(`${EXPLORER}/contract/${VAULT}`);
    expect(result.value.contributions).toEqual([]);
  });

  it("answers 200-shaped evidence with nulls and empty lists when there is no decision, deployment or campaign", async () => {
    const deps = dependencies({
      decision: NOT_FOUND,
      deployment: NOT_FOUND,
      campaign: NOT_FOUND,
      company: NOT_FOUND
    });

    const result = await getAdminApplicationEvidence(deps, { applicationId: APPLICATION_ID });

    expect(result).toEqual({
      ok: true,
      value: {
        applicationId: APPLICATION_ID,
        applicationState: "approved",
        smeReference: "sme-001",
        companyName: null,
        decision: null,
        deployment: null,
        vault: null,
        contributions: [],
        distributions: [],
        reconciliation: null
      }
    });
    // Without a campaign there is nothing to list.
    expect(deps.contributionTransactions.listObservedContributionTransactions).not.toHaveBeenCalled();
    expect(deps.distributions.listByCampaign).not.toHaveBeenCalled();
  });

  it("keeps a pending deployment without a campaign id", async () => {
    const pending = without(DEPLOYMENT, "campaignId");
    const result = await getAdminApplicationEvidence(
      dependencies({ deployment: { ok: true, value: { ...pending, state: "pending" } }, campaign: NOT_FOUND }),
      { applicationId: APPLICATION_ID }
    );

    expect(result.ok && result.value.deployment).toEqual({ state: "pending", campaignId: null });
  });

  it("leaves the company name null for a legacy request without an owner, without reading businesses", async () => {
    const legacy = without(SME_REQUEST, "ownerUserId");
    const deps = dependencies({ smeRequest: { ok: true, value: legacy } });

    const result = await getAdminApplicationEvidence(deps, { applicationId: APPLICATION_ID });

    expect(result.ok && result.value.companyName).toBeNull();
    expect(deps.businesses.findByOwner).not.toHaveBeenCalled();
  });

  it("is not_found when the application review does not exist", async () => {
    const deps = dependencies({
      applicationReviews: {
        findById: vi.fn().mockResolvedValue(NOT_FOUND),
        readLatestHumanDecision: vi.fn()
      }
    });

    expect(await getAdminApplicationEvidence(deps, { applicationId: APPLICATION_ID })).toEqual(NOT_FOUND);
  });

  it("is not_found when the application has no SME request, consistent with the review context", async () => {
    expect(
      await getAdminApplicationEvidence(dependencies({ smeRequest: NOT_FOUND }), { applicationId: APPLICATION_ID })
    ).toEqual(NOT_FOUND);
  });

  it.each([
    ["review", { applicationReviews: { findById: vi.fn().mockResolvedValue(UNAVAILABLE), readLatestHumanDecision: vi.fn() } }],
    ["SME request", { smeRequest: UNAVAILABLE }],
    ["company", { company: UNAVAILABLE }],
    ["decision", { decision: UNAVAILABLE }],
    ["deployment", { deployment: UNAVAILABLE }],
    ["campaign", { campaign: UNAVAILABLE }],
    ["contributions", { contributions: UNAVAILABLE }],
    ["distributions", { distributions: UNAVAILABLE }]
  ])("is unavailable when the %s read fails, rather than dropping evidence silently", async (_label, overrides) => {
    expect(await getAdminApplicationEvidence(dependencies(overrides), { applicationId: APPLICATION_ID })).toEqual(
      UNAVAILABLE
    );
  });

  it("is unavailable when a dependency throws", async () => {
    const deps = dependencies();
    deps.campaigns.findByApplicationId = vi.fn().mockRejectedValue(new Error("boom"));

    expect(await getAdminApplicationEvidence(deps, { applicationId: APPLICATION_ID })).toEqual(UNAVAILABLE);
  });
});

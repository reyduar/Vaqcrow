import { describe, expect, it } from "vitest";
import {
  adminApplicationEvidenceSchema,
  parseAdminApplicationEvidence
} from "./admin-application-evidence.js";

/**
 * The ADMIN per-application Testnet evidence chain
 * (`GET /application-reviews/:applicationId/evidence`, Feature #438, WU2).
 *
 * Every explorer link is built by the API (the web never knows the network),
 * and `null` is the honest "sin dato": a vault adopted before the deploy hash
 * was persisted, an explorer base the `local` network does not have, or an
 * application that never reached a decision or a campaign.
 */
const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const DISTRIBUTION_ID = "323e4567-e89b-42d3-a456-426614174000";
const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const INVESTOR = `G${"A".repeat(55)}`;
const DEPLOY_HASH = "b".repeat(64);
const CONTRIBUTION_HASH = "c".repeat(64);
const DISTRIBUTION_HASH = "d".repeat(64);
const EXPLORER = "https://stellar.expert/explorer/testnet";

const evidence = {
  applicationId: APPLICATION_ID,
  applicationState: "approved",
  smeReference: "sme-001",
  companyName: "Panadería Sol",
  decision: {
    actor: "Admin Vaqcrow",
    outcome: "approved",
    reason: "Documentación completa",
    approvedLimitArs: 5_000_000,
    decidedAt: "2026-10-01T12:00:00.000Z"
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
      observedAt: "2026-10-02T12:00:00.000Z",
      explorerUrl: `${EXPLORER}/tx/${CONTRIBUTION_HASH}`
    }
  ],
  distributions: [
    {
      distributionId: DISTRIBUTION_ID,
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
    }
  ],
  reconciliation: {
    status: "in_sync",
    lastReconciledAt: "2026-10-03T12:00:00.000Z",
    lastDivergedAt: null
  }
};

const bare = {
  applicationId: APPLICATION_ID,
  applicationState: "human_review",
  smeReference: "sme-001",
  companyName: null,
  decision: null,
  deployment: null,
  vault: null,
  contributions: [],
  distributions: [],
  reconciliation: null
};

describe("adminApplicationEvidenceSchema", () => {
  it("accepts the full evidence chain unchanged", () => {
    expect(parseAdminApplicationEvidence(evidence)).toEqual(evidence);
  });

  it("accepts an application without decision, deployment or campaign (nulls and empty lists)", () => {
    expect(parseAdminApplicationEvidence(bare)).toEqual(bare);
  });

  it("accepts null explorer links and a missing deploy hash (no explorer base, adopted vault)", () => {
    const local = {
      ...evidence,
      vault: { ...evidence.vault, vaultExplorerUrl: null, deployTransactionHash: null, deployExplorerUrl: null },
      contributions: [{ ...evidence.contributions[0], explorerUrl: null }],
      distributions: [{ ...evidence.distributions[0], explorerUrl: null }]
    };

    expect(parseAdminApplicationEvidence(local)).toEqual(local);
  });

  it("rejects a deploy explorer link without the hash it would open", () => {
    const result = adminApplicationEvidenceSchema.safeParse({
      ...evidence,
      vault: { ...evidence.vault, deployTransactionHash: null }
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["a non-hex transaction hash", { contributions: [{ ...evidence.contributions[0], transactionHash: "nope" }] }],
    ["a fractional stroop amount", { contributions: [{ ...evidence.contributions[0], amountStroops: "1.5" }] }],
    ["a numeric (float-prone) stroop amount", { vault: { ...evidence.vault, totalStroops: 100 } }],
    ["a non-contract vault address", { vault: { ...evidence.vault, contractAddress: INVESTOR } }],
    ["an unknown deployment state", { deployment: { state: "done", campaignId: CAMPAIGN_ID } }],
    ["an unknown reconciliation status", { reconciliation: { ...evidence.reconciliation, status: "maybe" } }],
    ["a leaked extra field", { ownerUserId: "00000000-0000-4000-8000-000000000001" }],
    ["a decision carrying its correlation id", { decision: { ...evidence.decision, correlationId: APPLICATION_ID } }]
  ])("rejects %s", (_label, override) => {
    expect(adminApplicationEvidenceSchema.safeParse({ ...evidence, ...override }).success).toBe(false);
  });
});

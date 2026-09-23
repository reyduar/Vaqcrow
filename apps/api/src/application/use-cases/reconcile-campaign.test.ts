import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type {
  CampaignRecord,
  CampaignRepositoryPort,
  CampaignRepositoryResult,
  CampaignReconciliationOutcome,
  ChainCampaignSnapshot
} from "../ports/campaign-repository-port.js";
import { reconcileCampaign } from "./reconcile-campaign.js";

const correlationId = parseCorrelationId("33333333-3333-4333-8333-333333333333");
const campaign: CampaignRecord = {
  campaignId: "11111111-1111-4111-8111-111111111111",
  applicationId: parseApplicationId("22222222-2222-4222-8222-222222222222"),
  contractAddress: "CCAMPAIGN",
  network: "testnet",
  tokenContractAddress: "CTOKEN",
  goalStroops: 1_000n,
  deadline: "2026-10-01T12:00:00.000Z",
  state: "open",
  totalStroops: 200n,
  reconciliationStatus: "in_sync",
  lastReconciledAt: "2026-09-23T12:00:00.000Z",
  createdAt: "2026-09-23T10:00:00.000Z",
  updatedAt: "2026-09-23T12:00:00.000Z"
};

const snapshot: ChainCampaignSnapshot = {
  state: "open",
  totalStroops: 400n,
  observedAt: "2026-09-23T12:05:00.000Z",
  contributions: []
};

function repositoryReturning(
  found: CampaignRepositoryResult<CampaignRecord>,
  reconciled: CampaignRepositoryResult<CampaignReconciliationOutcome>
): CampaignRepositoryPort {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
    findContributions: vi.fn(),
    reconcile: vi.fn().mockResolvedValue(reconciled),
    saveRefundContact: vi.fn()
  };
}

describe("reconcileCampaign", () => {
  it("marks a stale mirror as diverged before applying the chain snapshot", async () => {
    const updated = { ...campaign, totalStroops: 400n, reconciliationStatus: "diverged" as const };
    const repository = repositoryReturning({ ok: true, value: campaign }, { ok: true, value: { campaign: updated, applied: true } });

    await expect(reconcileCampaign(repository, { campaignId: campaign.campaignId, snapshot, correlationId })).resolves.toEqual({
      ok: true,
      value: { campaign: updated, applied: true }
    });
    expect(repository.reconcile).toHaveBeenCalledWith({
      campaignId: campaign.campaignId,
      expectedState: "open",
      snapshot,
      reconciliationStatus: "diverged",
      correlationId
    });
  });

  it("marks an identical observation in sync", async () => {
    const identical = { ...snapshot, totalStroops: campaign.totalStroops };
    const repository = repositoryReturning({ ok: true, value: campaign }, { ok: true, value: { campaign, applied: false } });

    await reconcileCampaign(repository, { campaignId: campaign.campaignId, snapshot: identical, correlationId });

    expect(repository.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ reconciliationStatus: "in_sync" })
    );
  });

  it.each(["not_found", "state_conflict", "unavailable", "already_exists"] as const)(
    "sanitizes repository error %s",
    async (code) => {
      const repository = repositoryReturning({ ok: false, error: { code } }, { ok: true, value: { campaign, applied: false } });

      await expect(reconcileCampaign(repository, { campaignId: campaign.campaignId, snapshot, correlationId })).resolves.toEqual({
        ok: false,
        error: { code: code === "already_exists" ? "unavailable" : code }
      });
    }
  );
});

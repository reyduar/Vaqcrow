import type { CorrelationId } from "@vaqcrow/contracts";
import type {
  CampaignRecord,
  CampaignRepositoryPort,
  ChainCampaignSnapshot,
  ReconciliationStatus
} from "../ports/campaign-repository-port.js";

export type ReconcileCampaignResult =
  | { readonly ok: true; readonly value: { readonly campaign: CampaignRecord; readonly applied: boolean } }
  | { readonly ok: false; readonly error: { readonly code: "not_found" | "state_conflict" | "unavailable" } };

/**
 * Replaces only mirror facts with a snapshot read from the contract. Divergence
 * is assessed before that write, so it is observable instead of silently erased.
 */
export async function reconcileCampaign(
  repository: CampaignRepositoryPort,
  input: { readonly campaignId: string; readonly snapshot: ChainCampaignSnapshot; readonly correlationId: CorrelationId }
): Promise<ReconcileCampaignResult> {
  const current = await repository.findById(input.campaignId);
  if (!current.ok) return { ok: false, error: toReconciliationError(current.error.code) };

  const reconciliationStatus: ReconciliationStatus =
    current.value.state === input.snapshot.state && current.value.totalStroops === input.snapshot.totalStroops
      ? "in_sync"
      : "diverged";

  const reconciled = await repository.reconcile({
    campaignId: input.campaignId,
    expectedState: current.value.state,
    snapshot: input.snapshot,
    reconciliationStatus,
    correlationId: input.correlationId
  });

  if (!reconciled.ok) return { ok: false, error: toReconciliationError(reconciled.error.code) };
  return { ok: true, value: reconciled.value };
}

function toReconciliationError(
  code: "not_found" | "already_exists" | "state_conflict" | "unavailable"
): { readonly code: "not_found" | "state_conflict" | "unavailable" } {
  return code === "already_exists" ? { code: "unavailable" } : { code };
}

import type { CampaignDeploymentRecord } from "../ports/campaign-deployment-repository-port.js";

/**
 * When a `deploying` attempt counts as abandoned (Feature #410, U8).
 *
 * A process crash or a request timeout mid-deploy leaves the row in
 * `deploying` with nothing left to finish it. Once its `updated_at` (kept by
 * the table's trigger, never by the API) is older than this threshold, a new
 * attempt may reclaim it. Reclaiming is safe against a double deploy because
 * `openCampaign` probes the deterministic vault address and adopts a vault the
 * abandoned attempt already deployed, instead of calling `factory.deploy` again.
 *
 * Server-side only: the web never decides staleness, it reads `retryable`.
 */
export const DEPLOYMENT_STALE_AFTER_MS = 10 * 60 * 1000;

type StalenessInput = Pick<CampaignDeploymentRecord, "state" | "updatedAt">;

/** The instant before which a `deploying` row is stale. */
export function deploymentStaleCutoff(now: Date): Date {
  return new Date(now.getTime() - DEPLOYMENT_STALE_AFTER_MS);
}

/** A `deploying` row last updated strictly before the cutoff; an unparseable timestamp is never stale. */
export function isDeploymentStale(record: StalenessInput, now: Date): boolean {
  if (record.state !== "deploying") return false;
  const updatedAt = Date.parse(record.updatedAt);
  if (Number.isNaN(updatedAt)) return false;
  return updatedAt < deploymentStaleCutoff(now).getTime();
}

/** Whether an admin may start a new attempt: the last one failed, or it was abandoned. */
export function isDeploymentRetryable(record: StalenessInput, now: Date): boolean {
  return record.state === "failed" || isDeploymentStale(record, now);
}

import type { ApplicationId, CorrelationId } from "@vaqcrow/contracts";
import type { ApplicationReviewRepositoryPort } from "../ports/application-review-repository-port.js";
import type { BusinessRepositoryPort } from "../ports/business-repository-port.js";
import type { CampaignDeploymentRecord, CampaignDeploymentRepositoryPort } from "../ports/campaign-deployment-repository-port.js";
import type { CampaignFactoryPort } from "../ports/campaign-factory-port.js";
import type { CampaignRepositoryPort } from "../ports/campaign-repository-port.js";
import type { CampaignVaultChainPort } from "../ports/campaign-vault-chain-port.js";
import type { NotificationEvent, NotificationPublisherPort } from "../ports/notification-publisher-port.js";
import type { RateSnapshot, RateTableRepositoryPort } from "../ports/rate-table-repository-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";
import type { StellarAccountPort } from "../ports/stellar-account-port.js";
import type { WalletRepositoryPort } from "../ports/wallet-repository-port.js";
import { RATE_SCALE, validateCampaignGuardrails } from "./campaign-guardrails.js";
import { deploymentStaleCutoff, isDeploymentStale } from "./deployment-staleness.js";
import { openCampaign } from "./open-campaign.js";
import type { OpenCampaignErrorCode } from "./open-campaign.js";

/**
 * Deploys (or retries) the vault for an approved application (Feature #410,
 * Task #410 / T5b), reusing the idempotent engine in `openCampaign` and giving
 * the attempt a durable, observable lifecycle in `campaign_deployment`.
 *
 * The PyME defines the terms at registration: this use case resolves the owner
 * from `sme_request`, the goal and deadline from the owner's business, and the
 * vault's immutable destination from the stored wallet key. The confirmed case
 * short-circuits before any resolution or deploy, so a replay is a no-op. Every
 * other failure is recorded as a sanitized code and returned, never thrown, so
 * the admin console can show `Despliegue fallido` with a retry.
 */

export type DeployApprovedCampaignErrorCode =
  | "application_not_found"
  | "application_not_approved"
  | "owner_unresolved"
  | "terms_unavailable"
  | "wallet_required"
  | "rate_unavailable"
  | "goal_limit_exceeded"
  | "deployment_in_progress"
  | "unavailable";

export type DeployApprovedCampaignResult =
  | { readonly ok: true; readonly value: { readonly deployment: CampaignDeploymentRecord } }
  | { readonly ok: false; readonly error: { readonly code: DeployApprovedCampaignErrorCode } };

export interface DeployApprovedCampaignDependencies {
  readonly applicationReviews: ApplicationReviewRepositoryPort;
  readonly deployments: CampaignDeploymentRepositoryPort;
  readonly smeRequests: Pick<SmeRequestRepositoryPort, "findByApplicationId">;
  readonly businesses: Pick<BusinessRepositoryPort, "findByOwner">;
  readonly wallet: Pick<WalletRepositoryPort, "readPublicKey">;
  readonly rates: RateTableRepositoryPort;
  // The existing deploy engine's own dependencies, reused unchanged.
  readonly campaigns: CampaignRepositoryPort;
  readonly accounts: StellarAccountPort;
  readonly factory: CampaignFactoryPort;
  readonly chain: CampaignVaultChainPort;
  readonly network: string;
  readonly tokenContractId: string;
  /** Best-effort approval notification; a failure never fails the deploy. */
  readonly notifications?: Pick<NotificationPublisherPort, "publish">;
  /** The clock that decides whether a `deploying` attempt is abandoned (U8). */
  readonly now: () => Date;
}

export interface DeployApprovedCampaignInput {
  readonly applicationId: ApplicationId;
  readonly correlationId: CorrelationId;
}

/**
 * Converts a whole-ARS goal to native stroops with integer-only arithmetic.
 *
 * `usdToArs` is a `RateSnapshot` value **stored scaled by `RATE_SCALE`** (see
 * `RateTableRepositoryPort`), so scaling ARS to USD needs the storage scale a
 * second time: `goalArs × RATE_SCALE × RATE_SCALE / usdToArs` is USD scaled by
 * `RATE_SCALE`, which dividing by `RATE_SCALE` then unpacks to native stroops.
 * Both divisions truncate toward zero; an unrepresentable or non-positive input
 * is `undefined` rather than a silently wrong amount.
 */
export function goalArsToStroops(input: {
  readonly goalArs: number;
  readonly rate: Pick<RateSnapshot, "usdToArs" | "stroopsPerUsd">;
}): bigint | undefined {
  const { goalArs, rate } = input;
  if (!Number.isSafeInteger(goalArs) || goalArs <= 0) return undefined;
  if (rate.usdToArs <= 0n || rate.stroopsPerUsd <= 0n) return undefined;

  const goalUsdScaled = (BigInt(goalArs) * RATE_SCALE * RATE_SCALE) / rate.usdToArs;
  const goalStroops = (goalUsdScaled * rate.stroopsPerUsd) / RATE_SCALE;
  return goalStroops;
}

export async function deployApprovedCampaign(
  dependencies: DeployApprovedCampaignDependencies,
  input: DeployApprovedCampaignInput
): Promise<DeployApprovedCampaignResult> {
  const { applicationId, correlationId } = input;

  const review = await dependencies.applicationReviews.findById(applicationId);
  if (!review.ok) {
    return review.error.code === "not_found"
      ? { ok: false, error: { code: "application_not_found" } }
      : { ok: false, error: { code: "unavailable" } };
  }
  if (review.value.state !== "approved") {
    return { ok: false, error: { code: "application_not_approved" } };
  }

  // A confirmed deployment is finished: return it without resolving terms,
  // reading the chain or touching the engine. This is what makes a replay a
  // no-op even after the wallet key would be frozen.
  const existing = await dependencies.deployments.findByApplicationId(applicationId);
  if (existing.ok && existing.value.state === "confirmed") {
    return { ok: true, value: { deployment: existing.value } };
  }
  if (!existing.ok && existing.error.code !== "not_found") {
    return { ok: false, error: { code: "unavailable" } };
  }

  // A recent attempt still owns the row: say so honestly instead of a 503. An
  // abandoned one (U8) falls through and is reclaimed by `beginAttempt`; that
  // is safe because `openCampaign` adopts a vault it may already have deployed.
  const now = dependencies.now();
  if (existing.ok && existing.value.state === "deploying" && !isDeploymentStale(existing.value, now)) {
    return { ok: false, error: { code: "deployment_in_progress" } };
  }

  // Record the durable pending row before any external work, so a failure to
  // resolve terms or reach Testnet is observable as a failed attempt.
  const pending = await dependencies.deployments.markPending({ applicationId, correlationId });
  if (!pending.ok) return { ok: false, error: { code: "unavailable" } };

  const begun = await dependencies.deployments.beginAttempt({
    applicationId,
    correlationId,
    staleBefore: deploymentStaleCutoff(now).toISOString()
  });
  if (!begun.ok) {
    // A concurrent attempt won the conditional update (or the row is no longer
    // retryable); never mark it failed. Only a persistence failure is a 503.
    return {
      ok: false,
      error: { code: begun.error.code === "state_conflict" ? "deployment_in_progress" : "unavailable" }
    };
  }

  const owner = await resolveOwner(dependencies.smeRequests, applicationId);
  if (!owner.ok) return fail(dependencies.deployments, applicationId, correlationId, "unavailable");
  if (owner.ownerUserId === undefined) {
    return fail(dependencies.deployments, applicationId, correlationId, "owner_unresolved");
  }
  const ownerUserId = owner.ownerUserId;

  const business = await dependencies.businesses.findByOwner(ownerUserId);
  if (!business.ok) {
    return fail(
      dependencies.deployments,
      applicationId,
      correlationId,
      business.error.code === "not_found" ? "terms_unavailable" : "unavailable"
    );
  }

  const deadlineIso = business.value.deadline;
  if (deadlineIso === undefined || deadlineIso === null) {
    return fail(dependencies.deployments, applicationId, correlationId, "terms_unavailable");
  }
  const deadline = new Date(deadlineIso);
  if (Number.isNaN(deadline.getTime())) {
    return fail(dependencies.deployments, applicationId, correlationId, "terms_unavailable");
  }

  const key = await dependencies.wallet.readPublicKey(ownerUserId);
  if (!key.ok) return fail(dependencies.deployments, applicationId, correlationId, "unavailable");
  if (key.value === null) return fail(dependencies.deployments, applicationId, correlationId, "wallet_required");

  const rate = await dependencies.rates.findCurrent(new Date().toISOString());
  if (!rate.ok) return fail(dependencies.deployments, applicationId, correlationId, "rate_unavailable");

  const goalStroops = goalArsToStroops({ goalArs: business.value.goalArs, rate: rate.value });
  if (goalStroops === undefined) {
    return fail(dependencies.deployments, applicationId, correlationId, "rate_unavailable");
  }

  const guardrail = validateCampaignGuardrails({ goalStroops, rate: rate.value });
  if (!guardrail.ok) {
    return fail(
      dependencies.deployments,
      applicationId,
      correlationId,
      guardrail.code === "goal_limit_exceeded" ? "goal_limit_exceeded" : "rate_unavailable"
    );
  }

  const opened = await openCampaign(
    {
      applicationReviews: dependencies.applicationReviews,
      campaigns: dependencies.campaigns,
      accounts: dependencies.accounts,
      factory: dependencies.factory,
      chain: dependencies.chain,
      rates: dependencies.rates,
      network: dependencies.network,
      tokenContractId: dependencies.tokenContractId
    },
    {
      command: { applicationId, smeAccountId: key.value, goalStroops, deadline },
      correlationId
    }
  );

  if (!opened.ok) {
    return fail(dependencies.deployments, applicationId, correlationId, mapOpenCampaignError(opened.error.code));
  }

  const confirmed = await dependencies.deployments.markConfirmed({
    applicationId,
    campaignId: opened.value.campaign.campaignId,
    correlationId
  });
  if (!confirmed.ok) {
    if (confirmed.error.code !== "state_conflict") return { ok: false, error: { code: "unavailable" } };
    // A stale reclaim superseded this attempt (U8): the reclaiming attempt owns
    // the outcome and its notification. Report what the row says now: its
    // confirmed record if the owner already finished, otherwise in progress.
    return supersededOutcome(dependencies.deployments, applicationId);
  }

  await publishApproved(dependencies.notifications, ownerUserId, applicationId);

  return { ok: true, value: { deployment: confirmed.value } };
}

type OwnerResolution =
  | { readonly ok: true; readonly ownerUserId: string | undefined }
  | { readonly ok: false };

/** Resolves the application's owner; `ok` is false when the lookup itself failed. */
async function resolveOwner(
  smeRequests: Pick<SmeRequestRepositoryPort, "findByApplicationId">,
  applicationId: ApplicationId
): Promise<OwnerResolution> {
  try {
    const owner = await smeRequests.findByApplicationId(applicationId);
    if (!owner.ok) {
      return owner.error.code === "not_found" ? { ok: true, ownerUserId: undefined } : { ok: false };
    }
    return { ok: true, ownerUserId: owner.value.ownerUserId };
  } catch {
    return { ok: false };
  }
}

function mapOpenCampaignError(code: OpenCampaignErrorCode): DeployApprovedCampaignErrorCode {
  switch (code) {
    case "application_not_found":
      return "application_not_found";
    case "application_not_approved":
      return "application_not_approved";
    case "rate_unavailable":
      return "rate_unavailable";
    case "goal_limit_exceeded":
      return "goal_limit_exceeded";
    default:
      return "unavailable";
  }
}

/**
 * The honest answer for an attempt whose confirmation was superseded: the
 * owning attempt's confirmed row (read, not re-written, and never re-notified
 * from here), or `deployment_in_progress` while that attempt is still open.
 */
async function supersededOutcome(
  deployments: CampaignDeploymentRepositoryPort,
  applicationId: ApplicationId
): Promise<DeployApprovedCampaignResult> {
  const current = await deployments.findByApplicationId(applicationId);
  if (current.ok && current.value.state === "confirmed") {
    return { ok: true, value: { deployment: current.value } };
  }
  if (!current.ok && current.error.code === "unavailable") {
    return { ok: false, error: { code: "unavailable" } };
  }
  return { ok: false, error: { code: "deployment_in_progress" } };
}

/**
 * Records the failed attempt and returns the same sanitized refusal. A
 * superseded attempt's write is refused by the repository (`state_conflict`,
 * U8) and the refusal returned is unchanged. Recording
 * is best-effort: a failing write must not change the outcome the caller sees.
 */
async function fail(
  deployments: CampaignDeploymentRepositoryPort,
  applicationId: ApplicationId,
  correlationId: CorrelationId,
  code: DeployApprovedCampaignErrorCode
): Promise<DeployApprovedCampaignResult> {
  try {
    await deployments.markFailed({ applicationId, errorCode: code, correlationId });
  } catch {
    // Bookkeeping only; the refusal is already determined.
  }
  return { ok: false, error: { code } };
}

/**
 * Publishes `pyme.approved_published` to the owner alone, after confirmation
 * and before returning. Idempotent at the row level via `eventKey`, and
 * best-effort: a delivery failure never fails a confirmed deploy.
 */
async function publishApproved(
  notifications: Pick<NotificationPublisherPort, "publish"> | undefined,
  ownerUserId: string,
  applicationId: ApplicationId
): Promise<void> {
  if (notifications === undefined) return;

  const event: NotificationEvent = {
    eventKey: `application:${applicationId}:deployment:confirmed`,
    type: "pyme.approved_published",
    recipientUserIds: [ownerUserId]
  };

  try {
    await notifications.publish(event);
  } catch {
    // Delivery is best-effort by contract; the deployment is already confirmed.
  }
}

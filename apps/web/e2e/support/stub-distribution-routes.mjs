/**
 * Deterministic local double for the revenue-share distribution HTTP contracts
 * (T5b). Mirrors the routes and wire shapes of
 * `apps/api/src/infrastructure/http/routes/revenue-share-distribution.route.ts`
 * and `packages/contracts/src/revenue-share-distribution.ts` closely enough for
 * the web's `HttpRevenueShareDistributionGateway` to drive it unmodified. It is
 * a test double, not the derivation: it reproduces the API's observable
 * decisions (who may sign, which campaigns qualify, what a repeat looks like)
 * with frozen literals, so two runs observe byte-identical responses.
 *
 * The derivation is the demo case: the latest reported period 2026-08 with
 * 3,745,800 ARS of sales at 450 bps gives a 168,561 ARS obligation, converted
 * to stroops in the proportion the campaign was funded
 * (`floor(obligationArs x goalStroops / approvedLimitArs)`), and split
 * pro-rata over the contributions the web reported through the transaction poll
 * (`?investor=`). Like the real API it refuses a campaign whose mirrored
 * contributions do not add up to its total (`contributions_incomplete`).
 */
import { getStubCampaign, STUB_NETWORK_PASSPHRASE } from "./stub-campaign-routes.mjs";

const DISTRIBUTION_ID = "60000000-0000-4000-8000-000000000000";
const CORRELATION_ID = "11111111-2222-4333-8444-555555555555";
const TRANSACTION_HASH = "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";
const EXPLORER_URL = `https://stellar.expert/explorer/testnet/tx/${TRANSACTION_HASH}`;
const FIXED_EXPIRES_AT = "2030-01-01T00:00:00.000Z";
const FIXED_TIMESTAMP = "2026-09-30T12:00:00.000Z";

const RULE_VERSION = "RS-2026-01";
const RATE_BPS = 450;
const PERIOD = "2026-08";
const SALES_ARS = 3745800n;
const APPROVED_LIMIT_ARS = 5000000n;
/** Periods of the demo series that cannot be used, reported rather than hidden. */
const EXCLUDED_PERIODS = Object.freeze([
  { period: "2026-04", status: "missing", reason: "missing_data" },
  { period: "2026-06", status: "anomalous", reason: "requires_review" }
]);

/** @type {{ period: string; campaignId: string; snapshot: object } | null} */
let distributed = null;

/** Drops every recorded distribution. Call between tests for isolation. */
export function resetDistributionFixtures() {
  distributed = null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasExactKeys(value, keys) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function failDerivation(sendJson, response, status, reason) {
  sendJson(response, status, { code: "derivation_failed", reason });
}

/** Pro-rata split by mirrored contribution, floor per recipient, the remainder to the first. */
function splitTotal(mirrored, totalStroops) {
  const contributions = [...mirrored.entries()];
  const sum = contributions.reduce((acc, [, amount]) => acc + amount, 0n);
  const shares = contributions.map(([accountId, amount]) => ({
    accountId,
    amountStroops: (totalStroops * amount) / sum
  }));
  const remainder = totalStroops - shares.reduce((acc, share) => acc + share.amountStroops, 0n);
  if (shares[0]) shares[0].amountStroops += remainder;
  return shares;
}

/** Runs the derivation the real API runs; returns either a failure or the derived case. */
function derive(body) {
  const campaign = getStubCampaign(body.campaignId);
  if (!campaign) return { failure: { status: 404, reason: "campaign_not_found" } };
  if (campaign.applicationId !== body.applicationId) {
    return { failure: { status: 409, reason: "application_mismatch" } };
  }
  if (body.sourceAccountId !== campaign.smeAccountId) {
    return { failure: { status: 409, reason: "source_not_sme" } };
  }
  if (campaign.state !== "settled") return { failure: { status: 409, reason: "campaign_not_settled" } };
  if (campaign.mirrored.size === 0) return { failure: { status: 422, reason: "no_contributors" } };

  const mirroredTotal = [...campaign.mirrored.values()].reduce((acc, amount) => acc + amount, 0n);
  if (mirroredTotal !== campaign.totalStroops) {
    return { failure: { status: 409, reason: "contributions_incomplete" } };
  }

  const obligationArs = (SALES_ARS * BigInt(RATE_BPS)) / 10_000n;
  const totalStroops = (obligationArs * campaign.goalStroops) / APPROVED_LIMIT_ARS;
  if (totalStroops === 0n) return { failure: { status: 422, reason: "obligation_rounds_to_zero" } };

  return {
    campaign,
    recipients: splitTotal(campaign.mirrored, totalStroops),
    derivation: {
      ruleVersion: RULE_VERSION,
      rateBps: RATE_BPS,
      period: PERIOD,
      salesArs: SALES_ARS.toString(),
      obligationArs: obligationArs.toString(),
      excludedPeriods: EXCLUDED_PERIODS,
      conversion: {
        goalStroops: campaign.goalStroops.toString(),
        approvedLimitArs: APPROVED_LIMIT_ARS.toString(),
        totalStroops: totalStroops.toString()
      },
      simulated: true
    }
  };
}

const toWireRecipients = (recipients) =>
  recipients.map((recipient) => ({ accountId: recipient.accountId, amountStroops: recipient.amountStroops.toString() }));

const DISTRIBUTION_PATH = /^\/revenue-share-distributions\/([^/]+)$/;
const SUBMISSION_PATH = /^\/revenue-share-distributions\/([^/]+)\/submission$/;

/**
 * Attempts to handle one distribution request. Returns `true` if it did (a
 * response was already sent), `false` if the path/method is not one of this
 * router's, so the caller can fall through to its own 404.
 */
export async function tryHandleDistributionRequest(request, response, method, pathname, { sendJson, readJsonBody }) {
  if (method === "POST" && pathname === "/revenue-share-distributions") {
    const body = await readJsonBody(request);
    const keys = ["sourceAccountId", "applicationId", "campaignId", "memo"];
    // The new contract carries no recipients: a body that declares any is refused.
    if (
      !hasExactKeys(body, keys) ||
      !isNonEmptyString(body.sourceAccountId) ||
      !isNonEmptyString(body.applicationId) ||
      !isNonEmptyString(body.campaignId)
    ) {
      sendJson(response, 400, { code: "invalid_request" });
      return true;
    }

    const derived = derive(body);
    if (derived.failure) {
      failDerivation(sendJson, response, derived.failure.status, derived.failure.reason);
      return true;
    }
    if (distributed && distributed.campaignId === body.campaignId && distributed.period === PERIOD) {
      sendJson(response, 409, { code: "already_distributed" });
      return true;
    }

    sendJson(response, 200, {
      distribution: {
        distributionId: DISTRIBUTION_ID,
        network: "LOCAL",
        networkPassphrase: STUB_NETWORK_PASSPHRASE,
        sourceAccountId: body.sourceAccountId,
        sourceSequence: "1234567891",
        memo: body.memo,
        expiresAt: FIXED_EXPIRES_AT,
        recipients: toWireRecipients(derived.recipients),
        xdr: `UNSIGNED_XDR:distribution:${body.campaignId}`,
        applicationId: body.applicationId,
        campaignId: body.campaignId,
        derivation: derived.derivation
      }
    });
    return true;
  }

  const submissionMatch = SUBMISSION_PATH.exec(pathname);
  if (method === "POST" && submissionMatch) {
    const body = await readJsonBody(request);
    if (
      !hasExactKeys(body, ["signedXdr", "terms", "applicationId", "campaignId"]) ||
      !isNonEmptyString(body.signedXdr) ||
      !isNonEmptyString(body.applicationId) ||
      !isNonEmptyString(body.campaignId)
    ) {
      sendJson(response, 400, { code: "invalid_request" });
      return true;
    }

    const derived = derive({
      sourceAccountId: body.terms?.sourceAccountId,
      applicationId: body.applicationId,
      campaignId: body.campaignId
    });
    if (derived.failure) {
      failDerivation(sendJson, response, derived.failure.status, derived.failure.reason);
      return true;
    }
    // Re-derive and compare, like the real submit: terms that differ are refused.
    if (JSON.stringify(body.terms.recipients) !== JSON.stringify(toWireRecipients(derived.recipients))) {
      sendJson(response, 422, { code: "derivation_mismatch" });
      return true;
    }
    if (distributed && distributed.campaignId === body.campaignId && distributed.period === PERIOD) {
      sendJson(response, 409, { code: "already_distributed" });
      return true;
    }

    const snapshot = {
      distributionId: decodeURIComponent(submissionMatch[1]),
      ...body.terms,
      state: "submitted",
      transactionHash: TRANSACTION_HASH,
      applicationId: body.applicationId,
      campaignId: body.campaignId,
      explorerUrl: EXPLORER_URL,
      failureReason: null,
      lastCorrelationId: CORRELATION_ID,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP
    };
    distributed = { period: PERIOD, campaignId: body.campaignId, snapshot };
    sendJson(response, 202, { applied: true, distribution: snapshot });
    return true;
  }

  const distributionMatch = DISTRIBUTION_PATH.exec(pathname);
  if (method === "GET" && distributionMatch) {
    if (!distributed || decodeURIComponent(distributionMatch[1]) !== distributed.snapshot.distributionId) {
      sendJson(response, 404, { code: "not_found" });
      return true;
    }
    // The double settles instantly, like the campaign double: a read is confirmed.
    sendJson(response, 200, { distribution: { ...distributed.snapshot, state: "confirmed" } });
    return true;
  }

  return false;
}

/**
 * Deterministic local double for the campaign vault HTTP contracts
 * (Task #248, `odd/tasks/campaign-vault-web-tests.md` D1). Mirrors the
 * routes and wire shapes of `apps/api/src/infrastructure/http/routes/campaign.route.ts`
 * and `packages/contracts/src/campaign.ts` closely enough for the web's
 * `HttpCampaignGateway` to drive it unmodified, but it is a test double, not
 * a chain: state transitions happen synchronously and instantly (a submitted
 * invocation is always already "success" or "failed" by the time it is
 * polled), so no test ever needs to wait out a real poll interval.
 *
 * Sibling module of `stub-api-server.mjs`, imported by it — kept separate so
 * the campaign vault's own state machine does not crowd the simpler demo
 * routes. Every value here is a frozen literal or a deterministic counter:
 * no `Date.now()`, no `new Date()`, no `Math.random()`, so two runs of the
 * suite observe byte-identical responses, exactly like the sibling module's
 * own rule.
 *
 * Scenario control is by account id: which fixed, syntactically valid
 * Stellar address (`G...`/`C...`) a test's Freighter emulation declares
 * decides the outcome, never a request header or a hidden test-only field —
 * the same "no test hooks in production shape" discipline `D2` applies to
 * the Freighter emulator applies here to the wire contract.
 *
 * `DEMO_APPLICATION_ID` is duplicated from `apps/web/src/application/fixtures/demo-application.ts`
 * on purpose, the same way `targets.ts` already duplicates it: `e2e/` must
 * not import from `src/`, and this is test-fixture data, not a shared
 * contract.
 */

const DEMO_APPLICATION_ID = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";

/**
 * The network passphrase this stub's `prepareInvocation` always declares.
 * Duplicated literally in `campaign-vault.spec.ts` for the same reason as
 * `DEMO_APPLICATION_ID` above — the spec has to configure a Freighter
 * scenario whose own declared passphrase matches (or, for the "wrong
 * network" case, deliberately does not match) this value.
 */
export const STUB_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

/** Scenario-selecting account ids. All syntactically valid (`G[A-Z2-7]{55}`), none real. */
export const SME_ACCOUNT_OK = `G${"A".repeat(55)}`;
export const SME_ACCOUNT_BLOCKED = `G${"B".repeat(55)}`;
export const INVESTOR_ACCOUNT_OK = `G${"C".repeat(55)}`;
export const INVESTOR_ACCOUNT_FAILED = `G${"D".repeat(55)}`;
export const INVESTOR_ACCOUNT_REFUND_TARGET = `G${"E".repeat(55)}`;
export const INVESTOR_ACCOUNT_REFUND_TRIGGER = `G${"F".repeat(55)}`;

/** Fixed campaign/contract ids so specs can navigate straight to a pre-seeded fixture via `?campaign=`. */
export const OPENED_CAMPAIGN_ID = "20000000-0000-4000-8000-000000000000";
export const FUNDING_CAMPAIGN_ID = "40000000-0000-4000-8000-000000000000";
export const REFUNDING_CAMPAIGN_ID = "30000000-0000-4000-8000-000000000000";

const CONTRACT_OPENED = `C${"N".repeat(55)}`;
const CONTRACT_FUNDING = `C${"K".repeat(55)}`;
const CONTRACT_REFUNDING = `C${"M".repeat(55)}`;

const XLM = 10_000_000n;

/** The funding fixture's goal: small enough that one generous contribution crosses it, large enough that a modest one does not. */
const FUNDING_FIXTURE_GOAL_STROOPS = 20n * XLM;
const REFUNDING_FIXTURE_GOAL_STROOPS = 100n * XLM;
const REFUNDING_FIXTURE_ALREADY_CONTRIBUTED_STROOPS = 30n * XLM;

const FIXED_INVOCATION_ID = "50000000-0000-4000-8000-000000000000";
const FIXED_EXPIRES_AT = "2030-01-01T00:00:00.000Z";

/** @type {Map<string, { campaignId: string; applicationId: string; contractAddress: string; network: string; state: "funding" | "settled" | "refunding"; goalStroops: bigint; totalStroops: bigint; deadline: string; smeAccountId: string; contributions: Map<string, bigint> }>} */
let campaigns = new Map();
/** @type {Map<string, { status: "success" | "failed"; campaignId: string }>} */
let transactions = new Map();
let invocationCounter = 0;
let transactionCounter = 0;

function freshFixtures() {
  const map = new Map();

  map.set(FUNDING_CAMPAIGN_ID, {
    campaignId: FUNDING_CAMPAIGN_ID,
    applicationId: DEMO_APPLICATION_ID,
    contractAddress: CONTRACT_FUNDING,
    network: "LOCAL",
    state: "funding",
    goalStroops: FUNDING_FIXTURE_GOAL_STROOPS,
    totalStroops: 0n,
    deadline: "2030-06-01T00:00:00.000Z",
    smeAccountId: SME_ACCOUNT_OK,
    contributions: new Map()
  });

  map.set(REFUNDING_CAMPAIGN_ID, {
    campaignId: REFUNDING_CAMPAIGN_ID,
    applicationId: DEMO_APPLICATION_ID,
    contractAddress: CONTRACT_REFUNDING,
    network: "LOCAL",
    state: "refunding",
    goalStroops: REFUNDING_FIXTURE_GOAL_STROOPS,
    totalStroops: REFUNDING_FIXTURE_ALREADY_CONTRIBUTED_STROOPS,
    deadline: "2020-01-01T00:00:00.000Z",
    smeAccountId: SME_ACCOUNT_OK,
    contributions: new Map([[INVESTOR_ACCOUNT_REFUND_TARGET, REFUNDING_FIXTURE_ALREADY_CONTRIBUTED_STROOPS]])
  });

  return map;
}

/** Resets every campaign to its seeded fixture and drops all opened/transaction state. Call between tests for isolation. */
export function resetCampaignFixtures() {
  campaigns = freshFixtures();
  transactions = new Map();
  invocationCounter = 0;
  transactionCounter = 0;
}

resetCampaignFixtures();

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** Encodes a campaign record for the wire: money as decimal strings, `investorContributionStroops` present only when a viewer was declared. */
function toCampaignWire(record, investorContributionStroops) {
  return {
    campaignId: record.campaignId,
    applicationId: record.applicationId,
    contractAddress: record.contractAddress,
    network: record.network,
    state: record.state,
    goalStroops: record.goalStroops.toString(),
    totalStroops: record.totalStroops.toString(),
    deadline: record.deadline,
    smeAccountId: record.smeAccountId,
    ...(investorContributionStroops === undefined
      ? {}
      : { investorContributionStroops: investorContributionStroops.toString() }),
    reconciliationStatus: "in_sync"
  };
}

/** Applies a settled invocation's effect. Only called for the "success" path — a "failed" transaction never mutates campaign state. */
function applyOperation(record, operation, investorAccountId, amountStroops) {
  const existing = record.contributions.get(investorAccountId) ?? 0n;

  if (operation === "contribute") {
    const amount = BigInt(amountStroops);
    record.contributions.set(investorAccountId, existing + amount);
    record.totalStroops += amount;
    if (record.state === "funding" && record.totalStroops >= record.goalStroops) {
      record.state = "settled";
    }
    return;
  }

  // withdraw and refund both return the investor's own recorded contribution
  // and zero it out; only the vault's own state (checked by the invocation
  // preparer, not here) decides which of the two is actually reachable.
  record.totalStroops -= existing;
  record.contributions.set(investorAccountId, 0n);
}

const CAMPAIGN_PATH = /^\/campaigns\/([^/]+)$/;
const INVOCATION_PATH = /^\/campaigns\/([^/]+)\/invocations$/;
const SUBMISSION_PATH = /^\/campaigns\/([^/]+)\/invocations\/submission$/;
const TRANSACTION_PATH = /^\/campaigns\/([^/]+)\/transactions\/([^/]+)$/;

/**
 * Attempts to handle one campaign-vault request. Returns `true` if it did
 * (a response was already sent), `false` if the path/method is not one of
 * this router's, so the caller can fall through to its own 404.
 */
export async function tryHandleCampaignRequest(request, response, method, pathname, url, { sendJson, readJsonBody }) {
  if (method === "POST" && pathname === "/campaigns") {
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      sendJson(response, 400, { code: "invalid_request" });
      return true;
    }

    const { applicationId, smeAccountId, goalStroops, deadline } = body;
    if (
      !isNonEmptyString(applicationId) ||
      !isNonEmptyString(smeAccountId) ||
      !isNonEmptyString(goalStroops) ||
      !isNonEmptyString(deadline)
    ) {
      sendJson(response, 400, { code: "invalid_request" });
      return true;
    }

    if (smeAccountId === SME_ACCOUNT_BLOCKED) {
      // The PyME's Stellar account could not be created or verified:
      // nothing was deployed and no vault exists yet (D3/T1).
      sendJson(response, 422, { code: "sme_account_unavailable" });
      return true;
    }

    const existing = campaigns.get(OPENED_CAMPAIGN_ID);
    if (existing) {
      sendJson(response, 200, { campaign: toCampaignWire(existing, undefined) });
      return true;
    }

    const record = {
      campaignId: OPENED_CAMPAIGN_ID,
      applicationId,
      contractAddress: CONTRACT_OPENED,
      network: "LOCAL",
      state: "funding",
      goalStroops: BigInt(goalStroops),
      totalStroops: 0n,
      deadline,
      smeAccountId,
      contributions: new Map()
    };
    campaigns.set(OPENED_CAMPAIGN_ID, record);
    sendJson(response, 201, { campaign: toCampaignWire(record, undefined) });
    return true;
  }

  const campaignMatch = CAMPAIGN_PATH.exec(pathname);
  if (method === "GET" && campaignMatch) {
    const campaignId = decodeURIComponent(campaignMatch[1]);
    const record = campaigns.get(campaignId);
    if (!record) {
      sendJson(response, 404, { code: "not_found" });
      return true;
    }

    const investor = url.searchParams.get("investor") ?? undefined;
    const investorContributionStroops = investor === undefined ? undefined : (record.contributions.get(investor) ?? 0n);
    sendJson(response, 200, { campaign: toCampaignWire(record, investorContributionStroops) });
    return true;
  }

  const invocationMatch = INVOCATION_PATH.exec(pathname);
  if (method === "POST" && invocationMatch) {
    const campaignId = decodeURIComponent(invocationMatch[1]);
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      sendJson(response, 400, { code: "invalid_request" });
      return true;
    }

    const { operation, investorAccountId } = body;
    if (!isNonEmptyString(operation) || !isNonEmptyString(investorAccountId)) {
      sendJson(response, 400, { code: "invalid_request" });
      return true;
    }

    const record = campaigns.get(campaignId);
    if (!record) {
      sendJson(response, 404, { code: "not_found" });
      return true;
    }

    if (operation === "contribute" && record.state !== "funding") {
      sendJson(response, 409, { code: "campaign_not_funding" });
      return true;
    }

    invocationCounter += 1;
    sendJson(response, 200, {
      contractInvocation: {
        invocationId: FIXED_INVOCATION_ID,
        operation,
        xdr: `UNSIGNED_XDR:${operation}:${campaignId}:${invocationCounter}`,
        networkPassphrase: STUB_NETWORK_PASSPHRASE,
        expiresAt: FIXED_EXPIRES_AT
      }
    });
    return true;
  }

  const submissionMatch = SUBMISSION_PATH.exec(pathname);
  if (method === "POST" && submissionMatch) {
    const campaignId = decodeURIComponent(submissionMatch[1]);
    const body = await readJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      sendJson(response, 400, { code: "invalid_request" });
      return true;
    }

    const { operation, investorAccountId, amountStroops, signedXdr } = body;
    if (!isNonEmptyString(operation) || !isNonEmptyString(investorAccountId) || !isNonEmptyString(signedXdr)) {
      sendJson(response, 400, { code: "invalid_request" });
      return true;
    }

    const record = campaigns.get(campaignId);
    if (!record) {
      sendJson(response, 404, { code: "not_found" });
      return true;
    }

    transactionCounter += 1;
    const transactionHash = `txhash-${transactionCounter}`;

    // A contribution from this account always reverts on-chain: the
    // submission is accepted, but the transaction itself settles "failed"
    // and the campaign is never mutated (no claimed success, no moved funds).
    if (operation === "contribute" && investorAccountId === INVESTOR_ACCOUNT_FAILED) {
      transactions.set(transactionHash, { status: "failed", campaignId });
      sendJson(response, 202, { transactionHash, status: "accepted" });
      return true;
    }

    applyOperation(record, operation, investorAccountId, amountStroops);
    transactions.set(transactionHash, { status: "success", campaignId });
    sendJson(response, 202, { transactionHash, status: "accepted" });
    return true;
  }

  const transactionMatch = TRANSACTION_PATH.exec(pathname);
  if (method === "GET" && transactionMatch) {
    const campaignId = decodeURIComponent(transactionMatch[1]);
    const transactionHash = decodeURIComponent(transactionMatch[2]);
    const outcome = transactions.get(transactionHash);
    if (!outcome) {
      sendJson(response, 503, { code: "unavailable" });
      return true;
    }

    if (outcome.status !== "success") {
      sendJson(response, 200, { transactionHash, status: outcome.status });
      return true;
    }

    const record = campaigns.get(campaignId);
    if (!record) {
      sendJson(response, 404, { code: "not_found" });
      return true;
    }

    // Matches the real transaction-status endpoint: the reconciled snapshot
    // it returns never carries `investorContributionStroops` (no `investor`
    // query parameter exists on this path).
    sendJson(response, 200, { transactionHash, status: "success", campaign: toCampaignWire(record, undefined) });
    return true;
  }

  return false;
}

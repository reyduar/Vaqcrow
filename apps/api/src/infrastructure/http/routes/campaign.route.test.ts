import { correlationIdSchema } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApplicationReviewRepositoryPort } from "../../../application/ports/application-review-repository-port.js";
import type { CampaignFactoryPort } from "../../../application/ports/campaign-factory-port.js";
import type {
  CampaignVaultChainPort,
  VaultChainState
} from "../../../application/ports/campaign-vault-chain-port.js";
import type {
  CampaignVaultInvocationPort,
  CampaignVaultInvocationVerification,
  VerifyCampaignVaultInvocationInput
} from "../../../application/ports/campaign-vault-invocation-port.js";
import type { CampaignRecord, CampaignRepositoryPort } from "../../../application/ports/campaign-repository-port.js";
import type { RateSnapshot, RateTableRepositoryPort } from "../../../application/ports/rate-table-repository-port.js";
import type { StellarAccountPort } from "../../../application/ports/stellar-account-port.js";
import { buildAppAs } from "../test-support/auth.js";
import type { CampaignRouteDependencies } from "./campaign.route.js";

const APPLICATION_ID = "87654321-4321-4abc-8def-123456789abc";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const INVOCATION_ID = "22222222-2222-4222-8222-222222222222";
const SME_ACCOUNT_ID = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const INVESTOR_ACCOUNT_ID = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBQ";
const OTHER_ACCOUNT_ID = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCQ";
const CONTRACT_ADDRESS = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const TOKEN_CONTRACT_ID = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBQ";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const TRANSACTION_HASH = "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";
const UNSIGNED_XDR = "AAAAAgAAAABfakeUnsignedEnvelope";
const SIGNED_XDR = "AAAAAgAAAABfakeSignedEnvelope";
const EXPLORER_BASE_URL = "https://stellar.expert/explorer/testnet";

const openBody = {
  applicationId: APPLICATION_ID,
  smeAccountId: SME_ACCOUNT_ID,
  goalStroops: "10000000",
  deadline: "2026-12-01T00:00:00.000Z"
};

const campaignRecord: CampaignRecord = {
  campaignId: CAMPAIGN_ID,
  applicationId: APPLICATION_ID as CampaignRecord["applicationId"],
  smeAccountId: SME_ACCOUNT_ID,
  contractAddress: CONTRACT_ADDRESS,
  network: "testnet",
  tokenContractAddress: TOKEN_CONTRACT_ID,
  goalStroops: 10_000_000n,
  deadline: "2026-12-01T00:00:00.000Z",
  state: "open",
  totalStroops: 0n,
  reconciliationStatus: "in_sync",
  lastReconciledAt: "2026-09-24T00:00:00.000Z",
  createdAt: "2026-09-24T00:00:00.000Z",
  updatedAt: "2026-09-24T00:00:00.000Z"
};

const RATE: RateSnapshot = {
  version: 5,
  effectiveAt: "2026-10-05T00:00:00.000Z",
  authorUserId: "44444444-4444-4444-8444-444444444444",
  source: "manual",
  usdToArs: 1_000_000_000n,
  stroopsPerUsd: 10_000_000n
};

/** A campaign whose terms were validated against `RATE` (#410/T3a). */
const campaignRecordWithRate: CampaignRecord = {
  ...campaignRecord,
  rateSnapshot: { version: RATE.version, usdToArs: RATE.usdToArs, stroopsPerUsd: RATE.stroopsPerUsd }
};

const fundingChainState: VaultChainState = {
  state: "funding",
  totalStroops: 0n,
  goalStroops: 10_000_000n,
  deadline: new Date("2026-12-01T00:00:00.000Z"),
  smeAccountId: SME_ACCOUNT_ID,
  tokenContractId: TOKEN_CONTRACT_ID,
  observedAt: new Date("2026-09-24T12:00:00.000Z")
};

function applicationReviewsDouble(): ApplicationReviewRepositoryPort {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    transition: vi.fn(),
    recordHumanDecision: vi.fn()
  } as unknown as ApplicationReviewRepositoryPort;
}

function accountsDouble(): StellarAccountPort {
  return {
    accountExists: vi.fn().mockResolvedValue({ ok: true, value: true }),
    createAccount: vi.fn()
  };
}

function factoryDouble(): CampaignFactoryPort {
  return {
    predict: vi.fn().mockResolvedValue({ ok: true, value: CONTRACT_ADDRESS }),
    deploy: vi.fn().mockResolvedValue({ ok: true, value: { contractAddress: CONTRACT_ADDRESS, hash: TRANSACTION_HASH } })
  };
}

function ratesDouble(
  overrides: Partial<{ [K in keyof RateTableRepositoryPort]: RateTableRepositoryPort[K] }> = {}
): RateTableRepositoryPort {
  return {
    create: vi.fn(),
    findCurrent: vi.fn().mockResolvedValue({ ok: true, value: RATE }),
    ...overrides
  };
}

function campaignsDouble(
  overrides: Partial<{ [K in keyof CampaignRepositoryPort]: CampaignRepositoryPort[K] }> = {}
): CampaignRepositoryPort {
  return {
    create: vi.fn().mockResolvedValue({ ok: true, value: campaignRecord }),
    findById: vi.fn().mockResolvedValue({ ok: true, value: campaignRecord }),
    findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }),
    findContributions: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    reconcile: vi.fn().mockResolvedValue({
      ok: true,
      value: { campaign: { ...campaignRecord, reconciliationStatus: "in_sync" }, applied: true }
    }),
    saveRefundContact: vi.fn(),
    ...overrides
  };
}

function chainDouble(
  overrides: Partial<{ [K in keyof CampaignVaultChainPort]: CampaignVaultChainPort[K] }> = {}
): CampaignVaultChainPort {
  return {
    readCampaign: vi.fn().mockResolvedValue({ ok: true, value: fundingChainState }),
    readContribution: vi.fn().mockResolvedValue({ ok: true, value: 0n }),
    ...overrides
  };
}

function invocationsDouble(
  overrides: Partial<{ [K in keyof CampaignVaultInvocationPort]: CampaignVaultInvocationPort[K] }> = {}
): CampaignVaultInvocationPort {
  const verified: CampaignVaultInvocationVerification = {
    ok: true,
    value: {
      transactionHash: TRANSACTION_HASH,
      sourceAccountId: INVESTOR_ACCOUNT_ID,
      operation: "contribute",
      investorAccountId: INVESTOR_ACCOUNT_ID,
      amountStroops: 5_000_000n
    }
  };

  return {
    prepare: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { xdr: UNSIGNED_XDR, networkPassphrase: NETWORK_PASSPHRASE, expiresAt: "2026-09-24T12:15:00.000Z" } }),
    verify: vi.fn().mockReturnValue(verified),
    submit: vi.fn().mockResolvedValue({ ok: true, value: { hash: TRANSACTION_HASH, status: "accepted" } }),
    findResult: vi.fn().mockResolvedValue({ ok: true, value: { status: "pending" } }),
    ...overrides
  };
}

function deps(
  overrides: Partial<CampaignRouteDependencies> = {}
): CampaignRouteDependencies {
  return {
    applicationReviews: applicationReviewsDouble(),
    campaigns: campaignsDouble(),
    accounts: accountsDouble(),
    factory: factoryDouble(),
    chain: chainDouble(),
    invocations: invocationsDouble(),
    rates: ratesDouble(),
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASE,
    tokenContractId: TOKEN_CONTRACT_ID,
    explorerBaseUrl: EXPLORER_BASE_URL,
    generateInvocationId: vi.fn(() => INVOCATION_ID),
    ...overrides
  };
}

// `applicationReviews.findById` is mocked per-test on demand for POST /campaigns.
function withApprovedApplication(applicationReviews: ApplicationReviewRepositoryPort): void {
  vi.mocked(applicationReviews.findById).mockResolvedValue({
    ok: true,
    value: { applicationId: APPLICATION_ID, state: "approved" } as never
  });
}

describe("POST /campaigns", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns 201 when the vault is opened for the first time", async () => {
    const applicationReviews = applicationReviewsDouble();
    withApprovedApplication(applicationReviews);
    const campaigns = campaignsDouble({
      findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }),
      create: vi.fn().mockResolvedValue({ ok: true, value: campaignRecord })
    });
    app = buildAppAs("ADMIN", { campaign: deps({ applicationReviews, campaigns }) });

    const response = await app.inject({ method: "POST", url: "/campaigns", payload: openBody });

    expect(response.statusCode).toBe(201);
  });

  it("returns 200 on an exact replay", async () => {
    const applicationReviews = applicationReviewsDouble();
    withApprovedApplication(applicationReviews);
    const campaigns = campaignsDouble({
      findByApplicationId: vi.fn().mockResolvedValue({ ok: true, value: campaignRecord })
    });
    app = buildAppAs("ADMIN", { campaign: deps({ applicationReviews, campaigns }) });

    const response = await app.inject({ method: "POST", url: "/campaigns", payload: openBody });

    expect(response.statusCode).toBe(200);
  });

  it("returns 404 when the application does not exist", async () => {
    const applicationReviews = applicationReviewsDouble();
    vi.mocked(applicationReviews.findById).mockResolvedValue({ ok: false, error: { code: "not_found" } });
    app = buildAppAs("ADMIN", { campaign: deps({ applicationReviews }) });

    const response = await app.inject({ method: "POST", url: "/campaigns", payload: openBody });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "application_not_found" });
  });

  it("returns 409 when the application was not approved", async () => {
    const applicationReviews = applicationReviewsDouble();
    vi.mocked(applicationReviews.findById).mockResolvedValue({
      ok: true,
      value: { applicationId: APPLICATION_ID, state: "in_review" } as never
    });
    app = buildAppAs("ADMIN", { campaign: deps({ applicationReviews }) });

    const response = await app.inject({ method: "POST", url: "/campaigns", payload: openBody });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: "application_not_approved" });
  });

  it("returns 422 sme_account_unavailable when the SME's account cannot be funded", async () => {
    const applicationReviews = applicationReviewsDouble();
    withApprovedApplication(applicationReviews);
    const campaigns = campaignsDouble({
      findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });
    // Not deployed yet: the probe finds nothing, so `openCampaign` attempts
    // to fund the SME's account before deploying.
    const chain = chainDouble({
      readCampaign: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });
    const accounts = accountsDouble();
    vi.mocked(accounts.accountExists).mockResolvedValue({ ok: true, value: false });
    vi.mocked(accounts.createAccount).mockResolvedValue({ ok: false, error: { code: "unavailable" } });
    app = buildAppAs("ADMIN", { campaign: deps({ applicationReviews, campaigns, accounts, chain }) });

    const response = await app.inject({ method: "POST", url: "/campaigns", payload: openBody });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "sme_account_unavailable" });
  });

  it("returns 422 vault_state_mismatch when the freshly deployed vault disagrees with the request", async () => {
    const applicationReviews = applicationReviewsDouble();
    withApprovedApplication(applicationReviews);
    const campaigns = campaignsDouble({
      findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });
    const chain = chainDouble({
      readCampaign: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, error: { code: "not_found" } })
        .mockResolvedValue({ ok: true, value: { ...fundingChainState, goalStroops: 1n } })
    });
    app = buildAppAs("ADMIN", { campaign: deps({ applicationReviews, campaigns, chain }) });

    const response = await app.inject({ method: "POST", url: "/campaigns", payload: openBody });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "vault_state_mismatch" });
  });

  it("returns 503 unavailable when the factory deploy fails", async () => {
    const applicationReviews = applicationReviewsDouble();
    withApprovedApplication(applicationReviews);
    const campaigns = campaignsDouble({
      findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });
    const chain = chainDouble({
      readCampaign: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });
    const factory = factoryDouble();
    vi.mocked(factory.deploy).mockResolvedValue({ ok: false, error: { code: "unavailable" } });
    app = buildAppAs("ADMIN", { campaign: deps({ applicationReviews, campaigns, chain, factory }) });

    const response = await app.inject({ method: "POST", url: "/campaigns", payload: openBody });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("returns 503 rate_unavailable when no current rate exists, without leaking provider text", async () => {
    const applicationReviews = applicationReviewsDouble();
    withApprovedApplication(applicationReviews);
    const campaigns = campaignsDouble({
      findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });
    const chain = chainDouble({
      readCampaign: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });
    const rates = ratesDouble({ findCurrent: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    app = buildAppAs("ADMIN", { campaign: deps({ applicationReviews, campaigns, chain, rates }) });

    const response = await app.inject({ method: "POST", url: "/campaigns", payload: openBody });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "rate_unavailable" });
  });

  it("returns 422 goal_limit_exceeded when the goal is above USD 50,000 at the current rate", async () => {
    const applicationReviews = applicationReviewsDouble();
    withApprovedApplication(applicationReviews);
    const campaigns = campaignsDouble({
      findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });
    const chain = chainDouble({
      readCampaign: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });
    const factory = factoryDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ applicationReviews, campaigns, chain, factory }) });

    const response = await app.inject({
      method: "POST",
      url: "/campaigns",
      // 50,001 USD at 10,000,000 stroops per USD, one stroop over the cap.
      payload: { ...openBody, goalStroops: "500010000000000" }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "goal_limit_exceeded" });
    expect(factory.deploy).not.toHaveBeenCalled();
  });

  it("rejects an unknown field with 400 invalid_request", async () => {
    app = buildAppAs("ADMIN", { campaign: deps() });

    const response = await app.inject({
      method: "POST",
      url: "/campaigns",
      payload: { ...openBody, extra: true }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });
});

describe("GET /campaigns/:campaignId", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("reconciles the mirror against a fresh chain read and returns the snapshot", async () => {
    app = buildAppAs("ADMIN", { campaign: deps() });

    const response = await app.inject({ method: "GET", url: `/campaigns/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.campaign.state).toBe("funding");
    expect(body.campaign.totalStroops).toBe("0");
    expect(body.campaign.investorContributionStroops).toBeUndefined();
  });

  it("includes the investor's own contribution when ?investor= is given", async () => {
    const chain = chainDouble({ readContribution: vi.fn().mockResolvedValue({ ok: true, value: 2_500_000n }) });
    app = buildAppAs("ADMIN", { campaign: deps({ chain }) });

    const response = await app.inject({
      method: "GET",
      url: `/campaigns/${CAMPAIGN_ID}?investor=${INVESTOR_ACCOUNT_ID}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().campaign.investorContributionStroops).toBe("2500000");
    expect(chain.readContribution).toHaveBeenCalledWith(CONTRACT_ADDRESS, INVESTOR_ACCOUNT_ID);
  });

  it("never serves the mirror as chain truth: 503 when the chain is unreachable", async () => {
    const chain = chainDouble({ readCampaign: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    app = buildAppAs("ADMIN", { campaign: deps({ chain }) });

    const response = await app.inject({ method: "GET", url: `/campaigns/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("returns 404 when the campaign is not mirrored", async () => {
    const campaigns = campaignsDouble({ findById: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) });
    app = buildAppAs("ADMIN", { campaign: deps({ campaigns }) });

    const response = await app.inject({ method: "GET", url: `/campaigns/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });
});

describe("POST /campaigns/:campaignId/invocations", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const contributeBody = {
    operation: "contribute",
    investorAccountId: INVESTOR_ACCOUNT_ID,
    sourceAccountId: null,
    amountStroops: "5000000"
  };

  it("always prepares contribute with sourceAccountId equal to the investor", async () => {
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: contributeBody
    });

    expect(response.statusCode).toBe(200);
    expect(invocations.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ sourceAccountId: INVESTOR_ACCOUNT_ID, contractAddress: CONTRACT_ADDRESS })
    );
    expect(response.json()).toEqual({
      contractInvocation: {
        invocationId: INVOCATION_ID,
        operation: "contribute",
        xdr: UNSIGNED_XDR,
        networkPassphrase: NETWORK_PASSPHRASE,
        expiresAt: "2026-09-24T12:15:00.000Z"
      }
    });
  });

  it("always prepares withdraw with sourceAccountId equal to the investor", async () => {
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: {
        operation: "withdraw",
        investorAccountId: INVESTOR_ACCOUNT_ID,
        sourceAccountId: INVESTOR_ACCOUNT_ID,
        amountStroops: null
      }
    });

    expect(invocations.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ sourceAccountId: INVESTOR_ACCOUNT_ID, operation: "withdraw" })
    );
  });

  it("prepares refund with the given source when one is provided", async () => {
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: {
        operation: "refund",
        investorAccountId: INVESTOR_ACCOUNT_ID,
        sourceAccountId: OTHER_ACCOUNT_ID,
        amountStroops: null
      }
    });

    expect(invocations.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ sourceAccountId: OTHER_ACCOUNT_ID, operation: "refund" })
    );
  });

  it("prepares refund with the investor as source when none is given", async () => {
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: {
        operation: "refund",
        investorAccountId: INVESTOR_ACCOUNT_ID,
        sourceAccountId: null,
        amountStroops: null
      }
    });

    expect(invocations.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ sourceAccountId: INVESTOR_ACCOUNT_ID, operation: "refund" })
    );
  });

  it("refuses a contribute when the chain state is not funding", async () => {
    const chain = chainDouble({
      readCampaign: vi.fn().mockResolvedValue({ ok: true, value: { ...fundingChainState, state: "settled" } })
    });
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ chain, invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: contributeBody
    });

    expect(response.statusCode).toBe(409);
    expect(invocations.prepare).not.toHaveBeenCalled();
  });

  it("refuses a contribute that would exceed the per-investor cap before preparing (#410/T3a)", async () => {
    const campaigns = campaignsDouble({ findById: vi.fn().mockResolvedValue({ ok: true, value: campaignRecordWithRate }) });
    const chain = chainDouble({ readContribution: vi.fn().mockResolvedValue({ ok: true, value: 0n }) });
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ campaigns, chain, invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: contributeBody
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "investor_limit_exceeded" });
    expect(invocations.prepare).not.toHaveBeenCalled();
    expect(chain.readContribution).toHaveBeenCalledWith(CONTRACT_ADDRESS, INVESTOR_ACCOUNT_ID);
  });

  it("counts the investor's existing contribution toward the cap", async () => {
    const campaigns = campaignsDouble({ findById: vi.fn().mockResolvedValue({ ok: true, value: campaignRecordWithRate }) });
    // 900,000 existing + 500,000 requested = 1,400,000, above the 1,000,000 cap.
    const chain = chainDouble({ readContribution: vi.fn().mockResolvedValue({ ok: true, value: 900_000n }) });
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ campaigns, chain, invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: { ...contributeBody, amountStroops: "500000" }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "investor_limit_exceeded" });
    expect(invocations.prepare).not.toHaveBeenCalled();
  });

  it("prepares a contribute within the per-investor cap", async () => {
    const campaigns = campaignsDouble({ findById: vi.fn().mockResolvedValue({ ok: true, value: campaignRecordWithRate }) });
    const chain = chainDouble({ readContribution: vi.fn().mockResolvedValue({ ok: true, value: 0n }) });
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ campaigns, chain, invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: { ...contributeBody, amountStroops: "500000" }
    });

    expect(response.statusCode).toBe(200);
    expect(invocations.prepare).toHaveBeenCalled();
  });

  it("skips the per-investor preflight when the campaign has no rate snapshot (legacy campaign)", async () => {
    const chain = chainDouble({ readContribution: vi.fn() });
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ chain, invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: contributeBody
    });

    expect(response.statusCode).toBe(200);
    expect(invocations.prepare).toHaveBeenCalled();
    expect(chain.readContribution).not.toHaveBeenCalled();
  });

  it("returns 503 when the investor's existing contribution cannot be read for the preflight", async () => {
    const campaigns = campaignsDouble({ findById: vi.fn().mockResolvedValue({ ok: true, value: campaignRecordWithRate }) });
    const chain = chainDouble({ readContribution: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ campaigns, chain, invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: contributeBody
    });

    expect(response.statusCode).toBe(503);
    expect(invocations.prepare).not.toHaveBeenCalled();
  });

  it("returns 503 when the chain is unreachable while checking contribute eligibility", async () => {
    const chain = chainDouble({ readCampaign: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    app = buildAppAs("ADMIN", { campaign: deps({ chain }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: contributeBody
    });

    expect(response.statusCode).toBe(503);
  });

  it("maps invalid_input to 400 and unavailable to 503", async () => {
    const invocations = invocationsDouble({
      prepare: vi.fn().mockResolvedValue({ ok: false, error: { code: "invalid_input" } })
    });
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: contributeBody
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("rejects an unknown field with 400 invalid_request", async () => {
    app = buildAppAs("ADMIN", { campaign: deps() });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: { ...contributeBody, extra: true }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("returns 404 when the campaign is not mirrored", async () => {
    const campaigns = campaignsDouble({ findById: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) });
    app = buildAppAs("ADMIN", { campaign: deps({ campaigns }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations`,
      payload: contributeBody
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("POST /campaigns/:campaignId/invocations/submission", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const contributeSubmission = {
    operation: "contribute",
    investorAccountId: INVESTOR_ACCOUNT_ID,
    sourceAccountId: null,
    amountStroops: "5000000",
    signedXdr: SIGNED_XDR
  };

  it("always verifies contribute with sourceAccountId equal to the investor", async () => {
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations/submission`,
      payload: contributeSubmission
    });

    expect(response.statusCode).toBe(202);
    const verifyInput = vi.mocked(invocations.verify).mock.calls[0]?.[0] as VerifyCampaignVaultInvocationInput;
    expect(verifyInput.sourceAccountId).toBe(INVESTOR_ACCOUNT_ID);
    expect(verifyInput.contractAddress).toBe(CONTRACT_ADDRESS);
    expect(response.json()).toEqual({ transactionHash: TRANSACTION_HASH, status: "accepted" });
  });

  it("always verifies withdraw with sourceAccountId equal to the investor", async () => {
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations/submission`,
      payload: {
        operation: "withdraw",
        investorAccountId: INVESTOR_ACCOUNT_ID,
        sourceAccountId: INVESTOR_ACCOUNT_ID,
        amountStroops: null,
        signedXdr: SIGNED_XDR
      }
    });

    const verifyInput = vi.mocked(invocations.verify).mock.calls[0]?.[0] as VerifyCampaignVaultInvocationInput;
    expect(verifyInput.sourceAccountId).toBe(INVESTOR_ACCOUNT_ID);
  });

  it("omits sourceAccountId for refund so any self-signed source is accepted", async () => {
    const invocations = invocationsDouble();
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations/submission`,
      payload: {
        operation: "refund",
        investorAccountId: INVESTOR_ACCOUNT_ID,
        sourceAccountId: OTHER_ACCOUNT_ID,
        amountStroops: null,
        signedXdr: SIGNED_XDR
      }
    });

    const verifyInput = vi.mocked(invocations.verify).mock.calls[0]?.[0] as VerifyCampaignVaultInvocationInput;
    expect(verifyInput.sourceAccountId).toBeUndefined();
  });

  it("maps a refusal to 422 with the refusal code and no leaked reason", async () => {
    const invocations = invocationsDouble({
      verify: vi.fn().mockReturnValue({ ok: false, refusal: { code: "wrong_source", reason: "internal detail" } })
    });
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations/submission`,
      payload: contributeSubmission
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "wrong_source" });
    expect(response.body).not.toContain("internal detail");
    expect(invocations.submit).not.toHaveBeenCalled();
  });

  it("returns 422 when the submission is rejected", async () => {
    const invocations = invocationsDouble({
      submit: vi.fn().mockResolvedValue({ ok: true, value: { hash: TRANSACTION_HASH, status: "rejected" } })
    });
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations/submission`,
      payload: contributeSubmission
    });

    expect(response.statusCode).toBe(422);
  });

  it("returns 503 when the submission channel is unavailable", async () => {
    const invocations = invocationsDouble({
      submit: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } })
    });
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations/submission`,
      payload: contributeSubmission
    });

    expect(response.statusCode).toBe(503);
  });

  it("rejects an unknown field with 400 invalid_request", async () => {
    app = buildAppAs("ADMIN", { campaign: deps() });

    const response = await app.inject({
      method: "POST",
      url: `/campaigns/${CAMPAIGN_ID}/invocations/submission`,
      payload: { ...contributeSubmission, extra: true }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });
});

describe("GET /campaigns/:campaignId/transactions/:hash", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("reports a pending transaction with no campaign snapshot", async () => {
    app = buildAppAs("ADMIN", { campaign: deps() });

    const response = await app.inject({ method: "GET", url: `/campaigns/${CAMPAIGN_ID}/transactions/${TRANSACTION_HASH}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ transactionHash: TRANSACTION_HASH, status: "pending" });
  });

  it("re-reads and reconciles the chain on success, including the fresh snapshot", async () => {
    const invocations = invocationsDouble({
      findResult: vi.fn().mockResolvedValue({ ok: true, value: { status: "success" } })
    });
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    const response = await app.inject({ method: "GET", url: `/campaigns/${CAMPAIGN_ID}/transactions/${TRANSACTION_HASH}` });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("success");
    expect(body.campaign.state).toBe("funding");
  });

  describe("recording the confirmed contribution (?investor=)", () => {
    const success = () =>
      invocationsDouble({ findResult: vi.fn().mockResolvedValue({ ok: true, value: { status: "success" } }) });

    it("reads the investor's on-chain contribution and reconciles it into the mirror on success", async () => {
      const chain = chainDouble({ readContribution: vi.fn().mockResolvedValue({ ok: true, value: 2_500_000n }) });
      const campaigns = campaignsDouble();
      app = buildAppAs("ADMIN", { campaign: deps({ invocations: success(), chain, campaigns }) });

      const response = await app.inject({
        method: "GET",
        url: `/campaigns/${CAMPAIGN_ID}/transactions/${TRANSACTION_HASH}?investor=${INVESTOR_ACCOUNT_ID}`
      });

      expect(response.statusCode).toBe(200);
      expect(chain.readContribution).toHaveBeenCalledWith(CONTRACT_ADDRESS, INVESTOR_ACCOUNT_ID);
      const snapshot = vi.mocked(campaigns.reconcile).mock.calls[0]?.[0].snapshot;
      expect(snapshot?.contributions).toEqual([
        expect.objectContaining({ investorAccountId: INVESTOR_ACCOUNT_ID, amountStroops: 2_500_000n })
      ]);
    });

    it("records nothing when no investor is given, as before", async () => {
      const chain = chainDouble();
      const campaigns = campaignsDouble();
      app = buildAppAs("ADMIN", { campaign: deps({ invocations: success(), chain, campaigns }) });

      await app.inject({ method: "GET", url: `/campaigns/${CAMPAIGN_ID}/transactions/${TRANSACTION_HASH}` });

      expect(chain.readContribution).not.toHaveBeenCalled();
      expect(vi.mocked(campaigns.reconcile).mock.calls[0]?.[0].snapshot.contributions).toEqual([]);
    });

    it("does not read the chain for a pending transaction", async () => {
      const chain = chainDouble();
      app = buildAppAs("ADMIN", { campaign: deps({ chain }) });

      const response = await app.inject({
        method: "GET",
        url: `/campaigns/${CAMPAIGN_ID}/transactions/${TRANSACTION_HASH}?investor=${INVESTOR_ACCOUNT_ID}`
      });

      expect(response.json()).toEqual({ transactionHash: TRANSACTION_HASH, status: "pending" });
      expect(chain.readContribution).not.toHaveBeenCalled();
    });

    it("rejects a malformed investor with 400 before looking the transaction up", async () => {
      const invocations = success();
      app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

      const response = await app.inject({
        method: "GET",
        url: `/campaigns/${CAMPAIGN_ID}/transactions/${TRANSACTION_HASH}?investor=not-an-account`
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ code: "invalid_request" });
      expect(invocations.findResult).not.toHaveBeenCalled();
    });

    it("returns 503 when the investor's contribution cannot be read", async () => {
      const chain = chainDouble({
        readContribution: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } })
      });
      const campaigns = campaignsDouble();
      app = buildAppAs("ADMIN", { campaign: deps({ invocations: success(), chain, campaigns }) });

      const response = await app.inject({
        method: "GET",
        url: `/campaigns/${CAMPAIGN_ID}/transactions/${TRANSACTION_HASH}?investor=${INVESTOR_ACCOUNT_ID}`
      });

      expect(response.statusCode).toBe(503);
      expect(campaigns.reconcile).not.toHaveBeenCalled();
    });
  });

  it("returns 503 when the post-success chain read is unreachable", async () => {
    const invocations = invocationsDouble({
      findResult: vi.fn().mockResolvedValue({ ok: true, value: { status: "success" } })
    });
    const chain = chainDouble({ readCampaign: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    app = buildAppAs("ADMIN", { campaign: deps({ invocations, chain }) });

    const response = await app.inject({ method: "GET", url: `/campaigns/${CAMPAIGN_ID}/transactions/${TRANSACTION_HASH}` });

    expect(response.statusCode).toBe(503);
  });

  it("returns 503 when the transaction lookup is unavailable", async () => {
    const invocations = invocationsDouble({ findResult: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    app = buildAppAs("ADMIN", { campaign: deps({ invocations }) });

    const response = await app.inject({ method: "GET", url: `/campaigns/${CAMPAIGN_ID}/transactions/${TRANSACTION_HASH}` });

    expect(response.statusCode).toBe(503);
  });
});

describe("campaign route registration", () => {
  it("is absent when the campaign dependency group is not supplied", async () => {
    const app = buildAppAs("ADMIN");

    const response = await app.inject({ method: "GET", url: `/campaigns/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("sets the correlation ID header", async () => {
    const app = buildAppAs("ADMIN", { campaign: deps() });

    const response = await app.inject({ method: "GET", url: `/campaigns/${CAMPAIGN_ID}` });

    expect(correlationIdSchema.safeParse(response.headers["x-correlation-id"]).success).toBe(true);
    await app.close();
  });
});

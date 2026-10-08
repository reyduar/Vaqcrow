import type { ApplicationReviewSnapshot } from "@vaqcrow/contracts";
import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationReviewRepositoryPort, ApplicationReviewRepositoryResult } from "../ports/application-review-repository-port.js";
import type { BusinessRepositoryPort, BusinessRecord, BusinessRepositoryResult } from "../ports/business-repository-port.js";
import type {
  CampaignDeploymentRecord,
  CampaignDeploymentRepositoryPort,
  CampaignDeploymentRepositoryResult
} from "../ports/campaign-deployment-repository-port.js";
import type {
  CampaignFactoryPort,
  CampaignFactoryResult,
  DeployCampaignVaultOutcome
} from "../ports/campaign-factory-port.js";
import type {
  CampaignRecord,
  CampaignRepositoryPort,
  CampaignRepositoryResult
} from "../ports/campaign-repository-port.js";
import type {
  CampaignVaultChainPort,
  CampaignVaultChainResult,
  VaultChainState
} from "../ports/campaign-vault-chain-port.js";
import type { NotificationPublisherPort, PublishSummary } from "../ports/notification-publisher-port.js";
import type { RateSnapshot, RateTableRepositoryPort, RateTableResult } from "../ports/rate-table-repository-port.js";
import type {
  SmeRequestRecord,
  SmeRequestRepositoryPort,
  SmeRequestRepositoryResult
} from "../ports/sme-request-repository-port.js";
import type { StellarAccountPort, StellarAccountResult } from "../ports/stellar-account-port.js";
import type { WalletRepositoryPort, WalletRepositoryResult } from "../ports/wallet-repository-port.js";
import { RATE_SCALE } from "./campaign-guardrails.js";
import { deployApprovedCampaign, goalArsToStroops } from "./deploy-approved-campaign.js";

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const CORRELATION_ID = parseCorrelationId("123e4567-e89b-42d3-a456-426614174000");
const OWNER_USER_ID = "00000000-0000-4000-8000-0000000000a1";
const SME_ACCOUNT_ID = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const TOKEN_CONTRACT_ID = "CBFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFZ";
const CONTRACT_ADDRESS = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
const DEADLINE_ISO = "2027-01-01T00:00:00.000Z";
const GOAL_ARS = 12_000_000;
const AT = "2026-10-06T12:00:00.000Z";
// The injected clock: ten minutes (the stale threshold) after `NOW` minus the
// threshold is the cutoff the repository receives.
const NOW = "2026-10-06T12:30:00.000Z";
const STALE_BEFORE = "2026-10-06T12:20:00.000Z";

/**
 * 1 USD = 1,200.00 ARS (stored scaled by RATE_SCALE) and 1 USD = 1 XLM
 * (10,000,000 stroops). 12,000,000 ARS = 10,000 USD = 100,000,000,000 stroops.
 */
const RATE: RateSnapshot = {
  version: 5,
  effectiveAt: "2026-10-05T00:00:00.000Z",
  authorUserId: "44444444-4444-4444-8444-444444444444",
  source: "manual",
  usdToArs: 1_200_000_000n,
  stroopsPerUsd: 10_000_000n
};
const EXPECTED_GOAL_STROOPS = 100_000_000_000n;

const BUSINESS: BusinessRecord = {
  businessId: "55555555-5555-4555-8555-555555555555",
  ownerUserId: OWNER_USER_ID,
  name: "Panadería Sol",
  cuit: "20123456789",
  sector: "Alimentos",
  city: "CABA",
  description: "Panadería artesanal de barrio",
  goalArs: GOAL_ARS,
  revenueShare: 5,
  deadline: DEADLINE_ISO,
  createdAt: AT,
  updatedAt: AT
};

function approvedReview(): ApplicationReviewSnapshot {
  return { applicationId: APPLICATION_ID, state: "approved" };
}

function applicationReviews(
  find: ApplicationReviewRepositoryResult<ApplicationReviewSnapshot> = { ok: true, value: approvedReview() }
): ApplicationReviewRepositoryPort {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(find),
    transition: vi.fn(),
    recordHumanDecision: vi.fn(),
    recordAssessmentFailureHandoff: vi.fn(),
    readManualReviewContext: vi.fn(),
    readLatestHumanDecision: vi.fn()
  };
}

function smeRequests(
  result: SmeRequestRepositoryResult<SmeRequestRecord> = {
    ok: true,
    value: {
      applicationId: APPLICATION_ID,
      request: {
        smeReference: "sme:SYN-PH-0001",
        declaredTotalArs: 15_000_000,
        periodStart: "2026-01",
        periodEnd: "2026-08",
        simuladoLabel: "SIMULADO"
      },
      ownerUserId: OWNER_USER_ID
    }
  }
): Pick<SmeRequestRepositoryPort, "findByApplicationId"> {
  return { findByApplicationId: vi.fn().mockResolvedValue(result) };
}

function businesses(
  result: BusinessRepositoryResult<BusinessRecord> = { ok: true, value: BUSINESS }
): Pick<BusinessRepositoryPort, "findByOwner"> {
  return { findByOwner: vi.fn().mockResolvedValue(result) };
}

function wallets(
  result: WalletRepositoryResult<string | null> = { ok: true, value: SME_ACCOUNT_ID }
): Pick<WalletRepositoryPort, "readPublicKey"> {
  return { readPublicKey: vi.fn().mockResolvedValue(result) };
}

function rates(
  result: RateTableResult<RateSnapshot> = { ok: true, value: RATE }
): RateTableRepositoryPort & { readonly calls: { findCurrent: unknown[] } } {
  const calls = { findCurrent: [] as unknown[] };
  return {
    create: vi.fn(),
    findCurrent: vi.fn(async (now: string) => {
      calls.findCurrent.push(now);
      return result;
    }),
    calls
  };
}

function campaignRecord(): CampaignRecord {
  return {
    campaignId: CAMPAIGN_ID,
    applicationId: APPLICATION_ID,
    smeAccountId: SME_ACCOUNT_ID,
    contractAddress: CONTRACT_ADDRESS,
    network: "testnet",
    tokenContractAddress: TOKEN_CONTRACT_ID,
    goalStroops: EXPECTED_GOAL_STROOPS,
    deadline: DEADLINE_ISO,
    state: "open",
    totalStroops: 0n,
    reconciliationStatus: "in_sync",
    lastReconciledAt: AT,
    createdAt: AT,
    updatedAt: AT
  };
}

function campaigns(): CampaignRepositoryPort & {
  readonly calls: { create: unknown[]; findByApplicationId: unknown[]; findById: unknown[] };
} {
  const calls = { create: [] as unknown[], findByApplicationId: [] as unknown[], findById: [] as unknown[] };
  return {
    create: vi.fn(async (input) => {
      calls.create.push(input);
      return { ok: true, value: campaignRecord() } as CampaignRepositoryResult<CampaignRecord>;
    }),
    findById: vi.fn(async (campaignId: string) => {
      calls.findById.push(campaignId);
      return { ok: true, value: campaignRecord() } as CampaignRepositoryResult<CampaignRecord>;
    }),
    findByApplicationId: vi.fn(async (applicationId) => {
      calls.findByApplicationId.push(applicationId);
      return { ok: false, error: { code: "not_found" } } as CampaignRepositoryResult<CampaignRecord>;
    }),
    findContributions: vi.fn(),
    reconcile: vi.fn(),
    saveRefundContact: vi.fn(),
    calls
  };
}

function accounts(): StellarAccountPort & { readonly calls: { accountExists: number } } {
  const calls = { accountExists: 0 };
  return {
    accountExists: vi.fn(async () => {
      calls.accountExists += 1;
      return { ok: true, value: true } as StellarAccountResult<boolean>;
    }),
    createAccount: vi.fn(),
    calls
  };
}

function factory(): CampaignFactoryPort & { readonly calls: { deploy: unknown[] } } {
  const calls = { deploy: [] as unknown[] };
  return {
    predict: vi.fn().mockResolvedValue({ ok: true, value: CONTRACT_ADDRESS } as CampaignFactoryResult<string>),
    deploy: vi.fn(async (input) => {
      calls.deploy.push(input);
      return {
        ok: true,
        value: { contractAddress: CONTRACT_ADDRESS, hash: "deploy-hash" }
      } as CampaignFactoryResult<DeployCampaignVaultOutcome>;
    }),
    calls
  };
}

function fundingChainState(overrides: Partial<VaultChainState> = {}): VaultChainState {
  return {
    state: "funding",
    totalStroops: 0n,
    goalStroops: EXPECTED_GOAL_STROOPS,
    deadline: new Date(DEADLINE_ISO),
    smeAccountId: SME_ACCOUNT_ID,
    tokenContractId: TOKEN_CONTRACT_ID,
    observedAt: new Date(AT),
    ...overrides
  };
}

function chain(
  readCampaign: CampaignVaultChainResult<VaultChainState> = { ok: true, value: fundingChainState() },
  probe: CampaignVaultChainResult<VaultChainState> = { ok: false, error: { code: "not_found" } }
): CampaignVaultChainPort & { readonly calls: { readCampaign: number } } {
  const calls = { readCampaign: 0 };
  return {
    readCampaign: vi.fn(async () => {
      calls.readCampaign += 1;
      return calls.readCampaign === 1 ? probe : readCampaign;
    }),
    readContribution: vi.fn(),
    calls
  };
}

function deploymentRecord(overrides: Partial<CampaignDeploymentRecord> = {}): CampaignDeploymentRecord {
  return {
    applicationId: APPLICATION_ID,
    state: "pending",
    attempts: 0,
    lastCorrelationId: CORRELATION_ID,
    createdAt: AT,
    updatedAt: AT,
    ...overrides
  };
}

function deployments(options: {
  readonly found?: CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>;
  readonly markFailed?: CampaignDeploymentRepositoryResult<CampaignDeploymentRecord> | Error;
  readonly begin?: CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>;
  readonly confirm?: CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>;
  /** What a re-read after a superseded confirmation returns. */
  readonly reread?: CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>;
} = {}): CampaignDeploymentRepositoryPort & {
  readonly calls: {
    markPending: unknown[];
    beginAttempt: unknown[];
    markConfirmed: unknown[];
    markFailed: unknown[];
  };
} {
  const calls = {
    markPending: [] as unknown[],
    beginAttempt: [] as unknown[],
    markConfirmed: [] as unknown[],
    markFailed: [] as unknown[]
  };
  const pending = deploymentRecord();
  const deploying = deploymentRecord({ state: "deploying", attempts: 1 });
  const confirmed = deploymentRecord({ state: "confirmed", attempts: 1, campaignId: CAMPAIGN_ID });

  return {
    findByApplicationId: (() => {
      const read = vi
        .fn<CampaignDeploymentRepositoryPort["findByApplicationId"]>()
        .mockResolvedValue(options.found ?? { ok: false, error: { code: "not_found" } });
      if (options.reread !== undefined) {
        read
          .mockResolvedValueOnce(options.found ?? { ok: false, error: { code: "not_found" } })
          .mockResolvedValueOnce(options.reread);
      }
      return read;
    })(),
    markPending: vi.fn<CampaignDeploymentRepositoryPort["markPending"]>(async (input) => {
      calls.markPending.push(input);
      return { ok: true, value: pending };
    }),
    beginAttempt: vi.fn<CampaignDeploymentRepositoryPort["beginAttempt"]>(async (input) => {
      calls.beginAttempt.push(input);
      return options.begin ?? { ok: true, value: deploying };
    }),
    markConfirmed: vi.fn<CampaignDeploymentRepositoryPort["markConfirmed"]>(async (input) => {
      calls.markConfirmed.push(input);
      return options.confirm ?? { ok: true, value: confirmed };
    }),
    markFailed: vi.fn<CampaignDeploymentRepositoryPort["markFailed"]>(async (input) => {
      calls.markFailed.push(input);
      if (options.markFailed instanceof Error) throw options.markFailed;
      return (
        options.markFailed ?? {
          ok: true,
          value: deploymentRecord({ state: "failed", attempts: 1, lastError: input.errorCode })
        }
      );
    }),
    calls
  };
}

interface Overrides {
  readonly applicationReviews?: ApplicationReviewRepositoryPort;
  readonly smeRequests?: ReturnType<typeof smeRequests>;
  readonly businesses?: ReturnType<typeof businesses>;
  readonly wallets?: ReturnType<typeof wallets>;
  readonly rates?: ReturnType<typeof rates>;
  readonly campaigns?: ReturnType<typeof campaigns>;
  readonly accounts?: ReturnType<typeof accounts>;
  readonly factory?: ReturnType<typeof factory>;
  readonly chain?: ReturnType<typeof chain>;
  readonly deployments?: ReturnType<typeof deployments>;
  readonly notifications?: Pick<NotificationPublisherPort, "publish">;
  readonly now?: () => Date;
}

function deps(overrides: Overrides = {}) {
  return {
    applicationReviews: overrides.applicationReviews ?? applicationReviews(),
    deployments: overrides.deployments ?? deployments(),
    smeRequests: overrides.smeRequests ?? smeRequests(),
    businesses: overrides.businesses ?? businesses(),
    wallet: overrides.wallets ?? wallets(),
    rates: overrides.rates ?? rates(),
    campaigns: overrides.campaigns ?? campaigns(),
    accounts: overrides.accounts ?? accounts(),
    factory: overrides.factory ?? factory(),
    chain: overrides.chain ?? chain(),
    network: "testnet",
    tokenContractId: TOKEN_CONTRACT_ID,
    now: overrides.now ?? (() => new Date(NOW)),
    ...(overrides.notifications === undefined ? {} : { notifications: overrides.notifications })
  };
}

function publishSpy(): {
  readonly notifications: Pick<NotificationPublisherPort, "publish">;
  readonly publish: ReturnType<typeof vi.fn<NotificationPublisherPort["publish"]>>;
} {
  const publish = vi.fn<NotificationPublisherPort["publish"]>().mockResolvedValue({
    recipients: 1,
    inserted: 1,
    skipped: 0,
    emailsSent: 1,
    emailsFailed: 0,
    failed: false
  } satisfies PublishSummary);
  return { notifications: { publish }, publish };
}

describe("goalArsToStroops", () => {
  it("converts whole ARS to native stroops with the stored fixed-point rate", () => {
    expect(goalArsToStroops({ goalArs: GOAL_ARS, rate: RATE })).toBe(EXPECTED_GOAL_STROOPS);
  });

  it("truncates toward zero instead of rounding", () => {
    // 1 ARS at 3 ARS/USD is 0.333 USD, i.e. 3.33 stroops at 10 stroops/USD.
    const rate = { usdToArs: 3n * RATE_SCALE, stroopsPerUsd: 10n };
    expect(goalArsToStroops({ goalArs: 1, rate })).toBe(3n);
  });

  it("refuses a non-positive goal or a non-positive rate", () => {
    expect(goalArsToStroops({ goalArs: 0, rate: RATE })).toBeUndefined();
    expect(goalArsToStroops({ goalArs: -1, rate: RATE })).toBeUndefined();
    expect(goalArsToStroops({ goalArs: GOAL_ARS, rate: { ...RATE, usdToArs: 0n } })).toBeUndefined();
    expect(goalArsToStroops({ goalArs: GOAL_ARS, rate: { ...RATE, stroopsPerUsd: 0n } })).toBeUndefined();
  });
});

describe("deployApprovedCampaign", () => {
  it("refuses an application that is not approved without touching the deployment row", async () => {
    const deploymentsPort = deployments();
    const result = await deployApprovedCampaign(
      deps({
        applicationReviews: applicationReviews({
          ok: true,
          value: { applicationId: APPLICATION_ID, state: "human_review" }
        }),
        deployments: deploymentsPort
      }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "application_not_approved" } });
    expect(deploymentsPort.calls.markPending).toHaveLength(0);
    expect(deploymentsPort.calls.beginAttempt).toHaveLength(0);
  });

  it("reports application_not_found when the review row does not exist", async () => {
    const result = await deployApprovedCampaign(
      deps({ applicationReviews: applicationReviews({ ok: false, error: { code: "not_found" } }) }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "application_not_found" } });
  });

  it("deploys, confirms and publishes the approval to the owner", async () => {
    const deploymentsPort = deployments();
    const ratesPort = rates();
    const factoryPort = factory();
    const { notifications, publish } = publishSpy();

    const result = await deployApprovedCampaign(
      deps({
        deployments: deploymentsPort,
        rates: ratesPort,
        factory: factoryPort,
        notifications
      }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({
      ok: true,
      value: { deployment: expect.objectContaining({ state: "confirmed", campaignId: CAMPAIGN_ID }) }
    });
    expect(deploymentsPort.calls.markPending).toEqual([
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    ]);
    expect(deploymentsPort.calls.beginAttempt).toEqual([
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID, staleBefore: STALE_BEFORE }
    ]);
    expect(deploymentsPort.calls.markConfirmed).toEqual([
      { applicationId: APPLICATION_ID, campaignId: CAMPAIGN_ID, correlationId: CORRELATION_ID }
    ]);
    // The rate is resolved for the ARS->stroops conversion; openCampaign
    // resolves it again for its own guardrail and snapshot.
    expect(ratesPort.calls.findCurrent.length).toBeGreaterThanOrEqual(1);
    const deployed = factoryPort.calls.deploy[0] as { goalStroops: bigint };
    expect(deployed.goalStroops).toBe(EXPECTED_GOAL_STROOPS);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[0]).toEqual({
      eventKey: `application:${APPLICATION_ID}:deployment:confirmed`,
      type: "pyme.approved_published",
      recipientUserIds: [OWNER_USER_ID]
    });
  });

  it("returns the confirmed deployment on replay without redeploying or republishing", async () => {
    const confirmed = deploymentRecord({ state: "confirmed", attempts: 1, campaignId: CAMPAIGN_ID });
    const deploymentsPort = deployments({ found: { ok: true, value: confirmed } });
    const factoryPort = factory();
    const { notifications, publish } = publishSpy();

    const result = await deployApprovedCampaign(
      deps({ deployments: deploymentsPort, factory: factoryPort, notifications }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: true, value: { deployment: confirmed } });
    expect(deploymentsPort.calls.markPending).toHaveLength(0);
    expect(deploymentsPort.calls.beginAttempt).toHaveLength(0);
    expect(deploymentsPort.calls.markConfirmed).toHaveLength(0);
    expect(factoryPort.calls.deploy).toHaveLength(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a missing deadline",
      businesses({ ok: true, value: { ...BUSINESS, deadline: null } }),
      "terms_unavailable"
    ],
    ["a missing company", businesses({ ok: false, error: { code: "not_found" } }), "terms_unavailable"]
  ] as const)("fails with %s and records the sanitized code", async (_label, businessesPort, code) => {
    const deploymentsPort = deployments();
    const factoryPort = factory();

    const result = await deployApprovedCampaign(
      deps({ deployments: deploymentsPort, businesses: businessesPort, factory: factoryPort }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code } });
    expect(deploymentsPort.calls.markFailed).toEqual([
      { applicationId: APPLICATION_ID, errorCode: code, correlationId: CORRELATION_ID }
    ]);
    expect(factoryPort.calls.deploy).toHaveLength(0);
  });

  describe("campaign duration (#410/U13)", () => {
    const DAY_MS = 86_400_000;
    // Millisecond noise on the attempt clock: the vault stores whole seconds.
    const ATTEMPT_AT = "2026-10-06T12:30:00.750Z";
    const durationBusiness = (overrides: Partial<BusinessRecord> = {}) =>
      businesses({ ok: true, value: { ...BUSINESS, deadline: null, campaignDurationDays: 60, ...overrides } });

    it("computes the deadline as the attempt's moment plus the chosen days, in whole seconds", async () => {
      const expected = new Date(Date.parse("2026-10-06T12:30:00.000Z") + 60 * DAY_MS);
      const factoryPort = factory();
      const campaignsPort = campaigns();

      const result = await deployApprovedCampaign(
        deps({
          businesses: durationBusiness(),
          factory: factoryPort,
          campaigns: campaignsPort,
          chain: chain({ ok: true, value: fundingChainState({ deadline: expected }) }),
          now: () => new Date(ATTEMPT_AT)
        }),
        { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
      );

      expect(result.ok).toBe(true);
      const deployed = factoryPort.calls.deploy[0] as { deadline: Date };
      expect(deployed.deadline.toISOString()).toBe("2026-12-05T12:30:00.000Z");
      const mirrored = campaignsPort.calls.create[0] as { campaign: { deadline: string } };
      expect(mirrored.campaign.deadline).toBe("2026-12-05T12:30:00.000Z");
    });

    it("prefers the chosen duration over a persisted legacy deadline", async () => {
      const expected = new Date(Date.parse(NOW) + 30 * DAY_MS);
      const factoryPort = factory();

      const result = await deployApprovedCampaign(
        deps({
          businesses: durationBusiness({ deadline: DEADLINE_ISO, campaignDurationDays: 30 }),
          factory: factoryPort,
          chain: chain({ ok: true, value: fundingChainState({ deadline: expected }) })
        }),
        { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
      );

      expect(result.ok).toBe(true);
      expect((factoryPort.calls.deploy[0] as { deadline: Date }).deadline.toISOString()).toBe(expected.toISOString());
    });

    it("counts a retry on a later day from that retry", async () => {
      const retryAt = new Date(Date.parse(NOW) + 3 * DAY_MS);
      const expected = new Date(retryAt.getTime() + 90 * DAY_MS);
      const failed = deploymentRecord({ state: "failed", attempts: 1, lastError: "terms_unavailable" });
      const factoryPort = factory();

      const result = await deployApprovedCampaign(
        deps({
          deployments: deployments({ found: { ok: true, value: failed } }),
          businesses: durationBusiness({ campaignDurationDays: 90 }),
          factory: factoryPort,
          chain: chain({ ok: true, value: fundingChainState({ deadline: expected }) }),
          now: () => retryAt
        }),
        { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
      );

      expect(result.ok).toBe(true);
      expect((factoryPort.calls.deploy[0] as { deadline: Date }).deadline.toISOString()).toBe(expected.toISOString());
    });

    it("adopts a vault an earlier attempt already deployed, keeping its on-chain deadline", async () => {
      // A previous attempt deployed on-chain and failed afterwards; the retry
      // computes a later deadline, but the vault's own deadline is the truth.
      const onChain = new Date(Date.parse("2026-10-01T09:00:00.000Z") + 60 * DAY_MS);
      const vault = fundingChainState({ deadline: onChain });
      const factoryPort = factory();
      const campaignsPort = campaigns();

      const result = await deployApprovedCampaign(
        deps({
          businesses: durationBusiness(),
          factory: factoryPort,
          campaigns: campaignsPort,
          chain: chain({ ok: true, value: vault }, { ok: true, value: vault })
        }),
        { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
      );

      expect(result.ok).toBe(true);
      expect(factoryPort.calls.deploy).toHaveLength(0);
      const mirrored = campaignsPort.calls.create[0] as { campaign: { deadline: string } };
      expect(mirrored.campaign.deadline).toBe(onChain.toISOString());
    });

    it("is terms_unavailable when the business has neither a duration nor a deadline", async () => {
      const deploymentsPort = deployments();
      const factoryPort = factory();

      const result = await deployApprovedCampaign(
        deps({
          deployments: deploymentsPort,
          businesses: durationBusiness({ campaignDurationDays: null }),
          factory: factoryPort
        }),
        { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
      );

      expect(result).toEqual({ ok: false, error: { code: "terms_unavailable" } });
      expect(factoryPort.calls.deploy).toHaveLength(0);
    });
  });

  it("fails with wallet_required when the owner has no public key", async () => {
    const deploymentsPort = deployments();
    const factoryPort = factory();

    const result = await deployApprovedCampaign(
      deps({
        deployments: deploymentsPort,
        wallets: wallets({ ok: true, value: null }),
        factory: factoryPort
      }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "wallet_required" } });
    expect(deploymentsPort.calls.markFailed).toEqual([
      { applicationId: APPLICATION_ID, errorCode: "wallet_required", correlationId: CORRELATION_ID }
    ]);
    expect(factoryPort.calls.deploy).toHaveLength(0);
  });

  it("fails with rate_unavailable when no current rate exists", async () => {
    const deploymentsPort = deployments();
    const factoryPort = factory();

    const result = await deployApprovedCampaign(
      deps({
        deployments: deploymentsPort,
        rates: rates({ ok: false, error: { code: "not_found" } }),
        factory: factoryPort
      }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "rate_unavailable" } });
    expect(deploymentsPort.calls.markFailed).toEqual([
      { applicationId: APPLICATION_ID, errorCode: "rate_unavailable", correlationId: CORRELATION_ID }
    ]);
    expect(factoryPort.calls.deploy).toHaveLength(0);
  });

  it("refuses a goal above the USD 50,000 ceiling with the integer guardrails", async () => {
    const overLimitBusiness = businesses({ ok: true, value: { ...BUSINESS, goalArs: 72_000_000 } });
    const deploymentsPort = deployments();
    const factoryPort = factory();

    const result = await deployApprovedCampaign(
      deps({ deployments: deploymentsPort, businesses: overLimitBusiness, factory: factoryPort }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "goal_limit_exceeded" } });
    expect(deploymentsPort.calls.markFailed).toEqual([
      { applicationId: APPLICATION_ID, errorCode: "goal_limit_exceeded", correlationId: CORRELATION_ID }
    ]);
    expect(factoryPort.calls.deploy).toHaveLength(0);
  });

  it("records a sanitized failure when the deploy engine fails", async () => {
    const deploymentsPort = deployments();
    const chainPort = chain({ ok: false, error: { code: "unavailable" } });

    const result = await deployApprovedCampaign(
      deps({ deployments: deploymentsPort, chain: chainPort }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(deploymentsPort.calls.markFailed).toEqual([
      { applicationId: APPLICATION_ID, errorCode: "unavailable", correlationId: CORRELATION_ID }
    ]);
  });

  it("fails with owner_unresolved when the request has no owner", async () => {
    const deploymentsPort = deployments();
    const result = await deployApprovedCampaign(
      deps({
        deployments: deploymentsPort,
        smeRequests: smeRequests({
          ok: true,
          value: {
            applicationId: APPLICATION_ID,
            request: {
              smeReference: "sme:SYN-PH-0001",
              declaredTotalArs: 15_000_000,
              periodStart: "2026-01",
              periodEnd: "2026-08",
              simuladoLabel: "SIMULADO"
            }
          }
        })
      }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "owner_unresolved" } });
    expect(deploymentsPort.calls.markFailed).toEqual([
      { applicationId: APPLICATION_ID, errorCode: "owner_unresolved", correlationId: CORRELATION_ID }
    ]);
  });

  it("still reports the failure when recording it fails, never throwing", async () => {
    const deploymentsPort = deployments({ markFailed: new Error("bookkeeping unavailable") });
    const result = await deployApprovedCampaign(
      deps({
        deployments: deploymentsPort,
        rates: rates({ ok: false, error: { code: "not_found" } })
      }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "rate_unavailable" } });
  });

  it("never fails the deployment when the approval notification throws", async () => {
    const publish = vi.fn<NotificationPublisherPort["publish"]>().mockRejectedValue(new Error("delivery down"));
    const result = await deployApprovedCampaign(
      deps({ notifications: { publish } }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toMatchObject({ ok: true, value: { deployment: expect.objectContaining({ state: "confirmed" }) } });
  });
});

describe("deployApprovedCampaign stale-attempt recovery (U8)", () => {
  it("answers deployment_in_progress for a fresh deploying row without touching it", async () => {
    // Updated five minutes before the injected clock: inside the threshold.
    const fresh = deploymentRecord({ state: "deploying", attempts: 1, updatedAt: "2026-10-06T12:25:00.000Z" });
    const deploymentsPort = deployments({ found: { ok: true, value: fresh } });
    const factoryPort = factory();

    const result = await deployApprovedCampaign(
      deps({ deployments: deploymentsPort, factory: factoryPort }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "deployment_in_progress" } });
    expect(deploymentsPort.calls.markPending).toHaveLength(0);
    expect(deploymentsPort.calls.beginAttempt).toHaveLength(0);
    expect(deploymentsPort.calls.markFailed).toHaveLength(0);
    expect(factoryPort.calls.deploy).toHaveLength(0);
  });

  it("reclaims a stale deploying row with the injected clock's cutoff and deploys", async () => {
    // Updated thirty minutes before the injected clock: past the threshold.
    const stale = deploymentRecord({ state: "deploying", attempts: 1, updatedAt: AT });
    const deploymentsPort = deployments({ found: { ok: true, value: stale } });
    const factoryPort = factory();

    const result = await deployApprovedCampaign(
      deps({ deployments: deploymentsPort, factory: factoryPort }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({
      ok: true,
      value: { deployment: expect.objectContaining({ state: "confirmed" }) }
    });
    expect(deploymentsPort.calls.beginAttempt).toEqual([
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID, staleBefore: STALE_BEFORE }
    ]);
    expect(factoryPort.calls.deploy).toHaveLength(1);
  });

  it("adopts the vault a crashed attempt already deployed instead of deploying twice", async () => {
    // The reclaimed attempt may have reached Testnet before it stopped: the
    // engine probes the deterministic address and adopts the vault there.
    const stale = deploymentRecord({ state: "deploying", attempts: 1, updatedAt: AT });
    const deploymentsPort = deployments({ found: { ok: true, value: stale } });
    const factoryPort = factory();

    const result = await deployApprovedCampaign(
      deps({
        deployments: deploymentsPort,
        factory: factoryPort,
        chain: chain({ ok: true, value: fundingChainState() }, { ok: true, value: fundingChainState() })
      }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result.ok).toBe(true);
    expect(factoryPort.calls.deploy).toHaveLength(0);
  });

  it("answers deployment_in_progress when a concurrent attempt wins the conditional update", async () => {
    const deploymentsPort = deployments({ begin: { ok: false, error: { code: "state_conflict" } } });
    const factoryPort = factory();

    const result = await deployApprovedCampaign(
      deps({ deployments: deploymentsPort, factory: factoryPort }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "deployment_in_progress" } });
    expect(deploymentsPort.calls.markFailed).toHaveLength(0);
    expect(factoryPort.calls.deploy).toHaveLength(0);
  });

  it("keeps unavailable for a genuine persistence failure when beginning the attempt", async () => {
    const deploymentsPort = deployments({ begin: { ok: false, error: { code: "unavailable" } } });

    const result = await deployApprovedCampaign(deps({ deployments: deploymentsPort }), {
      applicationId: APPLICATION_ID,
      correlationId: CORRELATION_ID
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(deploymentsPort.calls.markFailed).toHaveLength(0);
  });
});

describe("deployApprovedCampaign terminal writes owned by the attempt (U8)", () => {
  it("does not overwrite or notify when a reclaiming attempt superseded this one, and returns the row the owner confirmed", async () => {
    const ownerConfirmed = deploymentRecord({ state: "confirmed", attempts: 2, campaignId: CAMPAIGN_ID });
    const deploymentsPort = deployments({
      confirm: { ok: false, error: { code: "state_conflict" } },
      reread: { ok: true, value: ownerConfirmed }
    });
    const { notifications, publish } = publishSpy();

    const result = await deployApprovedCampaign(deps({ deployments: deploymentsPort, notifications }), {
      applicationId: APPLICATION_ID,
      correlationId: CORRELATION_ID
    });

    expect(deploymentsPort.calls.markConfirmed).toEqual([
      { applicationId: APPLICATION_ID, campaignId: CAMPAIGN_ID, correlationId: CORRELATION_ID }
    ]);
    expect(result).toEqual({ ok: true, value: { deployment: ownerConfirmed } });
    expect(publish).not.toHaveBeenCalled();
    expect(deploymentsPort.calls.markFailed).toHaveLength(0);
  });

  it("answers deployment_in_progress when superseded and the owning attempt has not finished", async () => {
    const deploymentsPort = deployments({
      confirm: { ok: false, error: { code: "state_conflict" } },
      reread: { ok: true, value: deploymentRecord({ state: "deploying", attempts: 2 }) }
    });
    const { notifications, publish } = publishSpy();

    const result = await deployApprovedCampaign(deps({ deployments: deploymentsPort, notifications }), {
      applicationId: APPLICATION_ID,
      correlationId: CORRELATION_ID
    });

    expect(result).toEqual({ ok: false, error: { code: "deployment_in_progress" } });
    expect(publish).not.toHaveBeenCalled();
  });

  it("keeps the refusal unchanged when a late failure write is superseded", async () => {
    const deploymentsPort = deployments({ markFailed: { ok: false, error: { code: "state_conflict" } } });

    const result = await deployApprovedCampaign(
      deps({
        deployments: deploymentsPort,
        wallets: wallets({ ok: true, value: null })
      }),
      { applicationId: APPLICATION_ID, correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "wallet_required" } });
    expect(deploymentsPort.calls.markFailed).toEqual([
      { applicationId: APPLICATION_ID, errorCode: "wallet_required", correlationId: CORRELATION_ID }
    ]);
  });
});

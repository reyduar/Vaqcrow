import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type {
  CampaignFactoryPort,
  CampaignFactoryResult,
  DeployCampaignVaultOutcome
} from "../ports/campaign-factory-port.js";
import type {
  CampaignVaultChainPort,
  CampaignVaultChainResult,
  VaultChainState
} from "../ports/campaign-vault-chain-port.js";
import type { CampaignRecord, CampaignRepositoryPort, CampaignRepositoryResult } from "../ports/campaign-repository-port.js";
import type { ApplicationReviewRepositoryPort, ApplicationReviewRepositoryResult } from "../ports/application-review-repository-port.js";
import type { StellarAccountPort, StellarAccountResult } from "../ports/stellar-account-port.js";
import { SME_STARTING_BALANCE_STROOPS, openCampaign } from "./open-campaign.js";
import type { ApplicationReviewSnapshot } from "@vaqcrow/contracts";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const SME_ACCOUNT_ID = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const TOKEN_CONTRACT_ID = "CBFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFZ";
const CONTRACT_ADDRESS = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const DEADLINE = new Date("2027-01-01T00:00:00.000Z");
const NETWORK = "testnet";

function command() {
  return {
    applicationId: APPLICATION_ID,
    smeAccountId: SME_ACCOUNT_ID,
    goalStroops: 1_000_0000000n,
    deadline: DEADLINE
  };
}

function approvedApplication(): ApplicationReviewSnapshot {
  return { applicationId: APPLICATION_ID, state: "approved" };
}

function applicationReviews(
  find: ApplicationReviewRepositoryResult<ApplicationReviewSnapshot> = { ok: true, value: approvedApplication() }
): ApplicationReviewRepositoryPort {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(find),
    transition: vi.fn(),
    recordHumanDecision: vi.fn()
  };
}

function campaignRecord(overrides: Partial<CampaignRecord> = {}): CampaignRecord {
  return {
    campaignId: "33333333-3333-4333-8333-333333333333",
    applicationId: APPLICATION_ID,
    smeAccountId: SME_ACCOUNT_ID,
    contractAddress: CONTRACT_ADDRESS,
    network: NETWORK,
    tokenContractAddress: TOKEN_CONTRACT_ID,
    goalStroops: command().goalStroops,
    deadline: DEADLINE.toISOString(),
    state: "open",
    totalStroops: 0n,
    reconciliationStatus: "in_sync",
    lastReconciledAt: "2026-09-24T00:00:00.000Z",
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    ...overrides
  };
}

interface CampaignRepoDeps {
  readonly findByApplicationId?: CampaignRepositoryResult<CampaignRecord>;
  readonly create?: CampaignRepositoryResult<CampaignRecord>;
}

function campaigns(deps: CampaignRepoDeps = {}): CampaignRepositoryPort & {
  readonly calls: { create: unknown[]; findByApplicationId: unknown[] };
} {
  const calls = { create: [] as unknown[], findByApplicationId: [] as unknown[] };
  const createDefault: CampaignRepositoryResult<CampaignRecord> = { ok: true, value: campaignRecord() };
  const findByApplicationIdDefault: CampaignRepositoryResult<CampaignRecord> = {
    ok: false,
    error: { code: "not_found" }
  };

  return {
    create: vi.fn(async (input) => {
      calls.create.push(input);
      return deps.create ?? createDefault;
    }),
    findById: vi.fn(),
    findByApplicationId: vi.fn(async (applicationId) => {
      calls.findByApplicationId.push(applicationId);
      return deps.findByApplicationId ?? findByApplicationIdDefault;
    }),
    findContributions: vi.fn(),
    reconcile: vi.fn(),
    saveRefundContact: vi.fn(),
    calls
  };
}

function accounts(
  exists: readonly StellarAccountResult<boolean>[],
  create: StellarAccountResult<{ readonly hash: string }> = { ok: true, value: { hash: "create-hash" } }
): StellarAccountPort & { readonly calls: { accountExists: number; createAccount: unknown[] } } {
  const calls = { accountExists: 0, createAccount: [] as unknown[] };
  let existsCursor = 0;

  return {
    accountExists: vi.fn(async () => {
      calls.accountExists += 1;
      const next = exists[existsCursor] ?? exists[exists.length - 1];
      existsCursor += 1;
      return next as StellarAccountResult<boolean>;
    }),
    createAccount: vi.fn(async (input) => {
      calls.createAccount.push(input);
      return create;
    }),
    calls
  };
}

function factory(
  deploy: CampaignFactoryResult<DeployCampaignVaultOutcome> = {
    ok: true,
    value: { contractAddress: CONTRACT_ADDRESS, hash: "deploy-hash" }
  },
  predict: CampaignFactoryResult<string> = { ok: true, value: CONTRACT_ADDRESS }
): CampaignFactoryPort & { readonly calls: { deploy: unknown[] } } {
  const calls = { deploy: [] as unknown[] };

  return {
    predict: vi.fn().mockResolvedValue(predict),
    deploy: vi.fn(async (input) => {
      calls.deploy.push(input);
      return deploy;
    }),
    calls
  };
}

function fundingChainState(overrides: Partial<VaultChainState> = {}): VaultChainState {
  return {
    state: "funding",
    totalStroops: 0n,
    goalStroops: command().goalStroops,
    deadline: DEADLINE,
    smeAccountId: SME_ACCOUNT_ID,
    tokenContractId: TOKEN_CONTRACT_ID,
    observedAt: new Date("2026-09-24T00:00:00.000Z"),
    ...overrides
  };
}

/**
 * The first `readCampaign` is the pre-deploy probe at the predicted address:
 * by default no vault lives there yet (`not_found`), so the use case deploys
 * and every later read returns `readCampaign`.
 */
function chain(
  readCampaign: CampaignVaultChainResult<VaultChainState> = { ok: true, value: fundingChainState() },
  probe: CampaignVaultChainResult<VaultChainState> = { ok: false, error: { code: "not_found" } }
): CampaignVaultChainPort {
  return {
    readCampaign: vi.fn().mockResolvedValueOnce(probe).mockResolvedValue(readCampaign),
    readContribution: vi.fn()
  };
}

function deps(overrides: {
  readonly applicationReviews?: ApplicationReviewRepositoryPort;
  readonly campaigns?: ReturnType<typeof campaigns>;
  readonly accounts?: ReturnType<typeof accounts>;
  readonly factory?: ReturnType<typeof factory>;
  readonly chain?: CampaignVaultChainPort;
}) {
  return {
    applicationReviews: overrides.applicationReviews ?? applicationReviews(),
    campaigns: overrides.campaigns ?? campaigns(),
    accounts: overrides.accounts ?? accounts([{ ok: true, value: true }]),
    factory: overrides.factory ?? factory(),
    chain: overrides.chain ?? chain(),
    network: NETWORK,
    tokenContractId: TOKEN_CONTRACT_ID
  };
}

describe("openCampaign", () => {
  it("derives the salt deterministically from the applicationId (D5)", async () => {
    const factoryPort = factory();

    await openCampaign(deps({ factory: factoryPort }), { command: command(), correlationId: CORRELATION_ID });

    const expectedSalt = new Uint8Array(createHash("sha256").update(APPLICATION_ID).digest());
    expect(factoryPort.predict).toHaveBeenCalledWith(expectedSalt);
    expect((factoryPort.calls.deploy[0] as { salt: Uint8Array }).salt).toEqual(expectedSalt);
  });

  it("refuses to open a vault for an application that was never approved", async () => {
    const result = await openCampaign(
      deps({ applicationReviews: applicationReviews({ ok: true, value: { applicationId: APPLICATION_ID, state: "human_review" } }) }),
      { command: command(), correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "application_not_approved" } });
  });

  it("reports application_not_found when the application does not exist", async () => {
    const result = await openCampaign(
      deps({ applicationReviews: applicationReviews({ ok: false, error: { code: "not_found" } }) }),
      { command: command(), correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "application_not_found" } });
  });

  it("replays an already-opened campaign instead of deploying again", async () => {
    const existing = campaignRecord();
    const factoryPort = factory();
    const campaignsPort = campaigns({ findByApplicationId: { ok: true, value: existing } });

    const result = await openCampaign(deps({ factory: factoryPort, campaigns: campaignsPort }), {
      command: command(),
      correlationId: CORRELATION_ID
    });

    expect(result).toEqual({ ok: true, value: { campaign: existing, applied: false } });
    expect(factoryPort.deploy).not.toHaveBeenCalled();
  });

  it("resumes a vault already deployed at the predicted address instead of deploying again", async () => {
    // A previous attempt deployed on-chain but failed before the mirror write:
    // the retry must adopt that vault, because a second deploy with the same
    // salt can never succeed.
    const factoryPort = factory();
    const campaignsPort = campaigns();

    const result = await openCampaign(
      deps({
        factory: factoryPort,
        campaigns: campaignsPort,
        chain: chain({ ok: true, value: fundingChainState() }, { ok: true, value: fundingChainState() })
      }),
      { command: command(), correlationId: CORRELATION_ID }
    );

    expect(result).toMatchObject({ ok: true, value: { applied: true } });
    expect(factoryPort.deploy).not.toHaveBeenCalled();
    expect(campaignsPort.calls.create[0]).toMatchObject({
      campaign: expect.objectContaining({ contractAddress: CONTRACT_ADDRESS })
    });
  });

  it("never deploys when the pre-deploy probe cannot tell whether a vault already exists", async () => {
    const factoryPort = factory();

    const result = await openCampaign(
      deps({
        factory: factoryPort,
        chain: chain({ ok: true, value: fundingChainState() }, { ok: false, error: { code: "unavailable" } })
      }),
      { command: command(), correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(factoryPort.deploy).not.toHaveBeenCalled();
  });

  it("creates the SME account when it does not exist yet, then re-verifies before deploying", async () => {
    const accountsPort = accounts([{ ok: true, value: false }, { ok: true, value: true }]);
    const factoryPort = factory();

    await openCampaign(deps({ accounts: accountsPort, factory: factoryPort }), {
      command: command(),
      correlationId: CORRELATION_ID
    });

    expect(accountsPort.createAccount).toHaveBeenCalledWith({
      destination: SME_ACCOUNT_ID,
      startingBalanceStroops: SME_STARTING_BALANCE_STROOPS
    });
    expect(accountsPort.calls.accountExists).toBe(2);
    expect(factoryPort.deploy).toHaveBeenCalled();
  });

  it("never deploys when the SME account still does not exist after funding it", async () => {
    const accountsPort = accounts([{ ok: true, value: false }, { ok: true, value: false }]);
    const factoryPort = factory();

    const result = await openCampaign(deps({ accounts: accountsPort, factory: factoryPort }), {
      command: command(),
      correlationId: CORRELATION_ID
    });

    expect(result).toEqual({ ok: false, error: { code: "sme_account_unavailable" } });
    expect(factoryPort.deploy).not.toHaveBeenCalled();
  });

  it("never writes the mirror before reading the deployed vault back from the chain", async () => {
    const calls: string[] = [];
    const readCampaignResult: CampaignVaultChainResult<VaultChainState> = { ok: true, value: fundingChainState() };
    const probeResult: CampaignVaultChainResult<VaultChainState> = { ok: false, error: { code: "not_found" } };
    let reads = 0;
    const chainPort: CampaignVaultChainPort = {
      readCampaign: vi.fn(async () => {
        reads += 1;
        if (reads === 1) {
          return probeResult;
        }
        calls.push("chain.readCampaign");
        return readCampaignResult;
      }),
      readContribution: vi.fn()
    };
    const createResult: CampaignRepositoryResult<CampaignRecord> = { ok: true, value: campaignRecord() };
    const campaignsPort = campaigns();
    (campaignsPort.create as ReturnType<typeof vi.fn>).mockImplementation(async (input: unknown) => {
      calls.push("campaigns.create");
      campaignsPort.calls.create.push(input);
      return createResult;
    });

    await openCampaign(deps({ chain: chainPort, campaigns: campaignsPort }), {
      command: command(),
      correlationId: CORRELATION_ID
    });

    expect(calls).toEqual(["chain.readCampaign", "campaigns.create"]);
  });

  it("refuses when the chain-observed vault does not match what was requested", async () => {
    const result = await openCampaign(
      deps({ chain: chain({ ok: true, value: fundingChainState({ goalStroops: 1n }) }) }),
      { command: command(), correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "vault_state_mismatch" } });
  });

  it("refuses when the deployed vault is not in the funding state", async () => {
    const result = await openCampaign(
      deps({ chain: chain({ ok: true, value: fundingChainState({ state: "settled" }) }) }),
      { command: command(), correlationId: CORRELATION_ID }
    );

    expect(result).toEqual({ ok: false, error: { code: "vault_state_mismatch" } });
  });

  it("mirrors the chain-observed snapshot together with the SME account on success", async () => {
    const campaignsPort = campaigns();

    const result = await openCampaign(deps({ campaigns: campaignsPort }), {
      command: command(),
      correlationId: CORRELATION_ID
    });

    expect(result).toMatchObject({ ok: true, value: { applied: true } });
    expect(campaignsPort.calls.create[0]).toMatchObject({
      campaign: expect.objectContaining({
        applicationId: APPLICATION_ID,
        smeAccountId: SME_ACCOUNT_ID,
        contractAddress: CONTRACT_ADDRESS,
        network: NETWORK,
        tokenContractAddress: TOKEN_CONTRACT_ID
      }),
      correlationId: CORRELATION_ID
    });
  });
});

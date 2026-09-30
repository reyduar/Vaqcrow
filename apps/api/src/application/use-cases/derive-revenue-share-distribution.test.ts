import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import type { HumanDecisionRecord, SalesPeriodContract, SmeRequest } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationReviewRepositoryPort } from "../ports/application-review-repository-port.js";
import type {
  CampaignContributionRecord,
  CampaignRecord,
  CampaignRepositoryPort
} from "../ports/campaign-repository-port.js";
import type { CampaignVaultChainPort } from "../ports/campaign-vault-chain-port.js";
import type { SalesDataProviderPort } from "../ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";
import {
  deriveRevenueShareDistribution,
  type DeriveRevenueShareDistributionDeps
} from "./derive-revenue-share-distribution.js";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const OTHER_APPLICATION_ID = parseApplicationId("99999999-9999-4999-8999-999999999999");
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE_ACCOUNT = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const INVESTOR_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const INVESTOR_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

/** 100 XLM goal: 1,000,000,000 stroops. */
const GOAL_STROOPS = 1_000_000_000n;
const APPROVED_LIMIT_ARS = 5_000_000;

const campaign: CampaignRecord = {
  campaignId: CAMPAIGN_ID,
  applicationId: APPLICATION_ID,
  smeAccountId: SOURCE_ACCOUNT,
  contractAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  network: "testnet",
  tokenContractAddress: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF",
  goalStroops: GOAL_STROOPS,
  deadline: "2026-12-01T00:00:00.000Z",
  state: "settled",
  totalStroops: GOAL_STROOPS,
  reconciliationStatus: "in_sync",
  lastReconciledAt: "2026-09-30T12:00:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-30T12:00:00.000Z"
};

function contribution(investorAccountId: string, amountStroops: bigint): CampaignContributionRecord {
  return { campaignId: CAMPAIGN_ID, investorAccountId, amountStroops, lastObservedAt: "2026-09-30T12:00:00.000Z" };
}

/** 60 % / 40 % of the goal, so the pro-rata split is exact and easy to read. */
const contributions = [contribution(INVESTOR_A, 600_000_000n), contribution(INVESTOR_B, 400_000_000n)];

const approvedDecision: HumanDecisionRecord = {
  decisionId: "44444444-4444-4444-8444-444444444444",
  applicationId: APPLICATION_ID,
  outcome: "approved",
  actor: "analyst",
  reason: "Looks sound",
  approvedLimitArs: APPROVED_LIMIT_ARS,
  decidedAt: "2026-09-30T10:00:00.000Z",
  correlationId: "22222222-2222-4222-8222-222222222222"
} as unknown as HumanDecisionRecord;

const request: SmeRequest = {
  smeReference: "sme:SYN-PH-0001",
  declaredTotalArs: 15_000_000,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

function period(
  period: string,
  amountArs: number | null,
  status: SalesPeriodContract["status"] = "reported"
): SalesPeriodContract {
  return { period, amountArs, status, evidenceRef: `sales:${period}`, simuladoLabel: "SIMULADO" };
}

/** The canonical series shape: April missing, June anomalous, August the latest reported. */
const series: readonly SalesPeriodContract[] = [
  period("2026-03", 3_410_750),
  period("2026-04", null, "missing"),
  period("2026-06", 6_240_000, "anomalous"),
  period("2026-07", 3_690_300),
  period("2026-08", 3_745_800)
];

const CHAIN_STATE_BY_MIRROR_STATE = { open: "funding", settled: "settled", refundable: "refunding" } as const;

function deps(
  overrides: {
    campaign?: unknown;
    chain?: unknown;
    reconcile?: unknown;
    contributions?: unknown;
    decision?: unknown;
    request?: unknown;
    sales?: unknown;
  } = {}
): DeriveRevenueShareDistributionDeps {
  const mirror = ((overrides.campaign as { ok: true; value: CampaignRecord } | undefined)?.value ??
    campaign) as CampaignRecord;

  // By default the chain agrees with the mirror, so every pre-existing case keeps
  // its meaning; the reconciliation cases override the chain explicitly.
  const chainState = {
    ok: true,
    value: {
      state: CHAIN_STATE_BY_MIRROR_STATE[mirror.state],
      totalStroops: mirror.totalStroops,
      goalStroops: mirror.goalStroops,
      deadline: new Date(mirror.deadline),
      smeAccountId: mirror.smeAccountId,
      tokenContractId: mirror.tokenContractAddress,
      observedAt: new Date("2026-09-30T13:00:00.000Z")
    }
  };

  return {
    campaigns: {
      findById: vi.fn().mockResolvedValue(overrides.campaign ?? { ok: true, value: campaign }),
      findContributions: vi.fn().mockResolvedValue(overrides.contributions ?? { ok: true, value: contributions }),
      reconcile: vi.fn().mockImplementation(
        async (call: { snapshot: { state: CampaignRecord["state"]; totalStroops: bigint } }) =>
          overrides.reconcile ?? {
            ok: true,
            value: {
              campaign: { ...mirror, state: call.snapshot.state, totalStroops: call.snapshot.totalStroops },
              applied: true
            }
          }
      )
    } as unknown as Pick<CampaignRepositoryPort, "findById" | "findContributions" | "reconcile">,
    chain: {
      readCampaign: vi.fn().mockResolvedValue(overrides.chain ?? chainState)
    } as unknown as Pick<CampaignVaultChainPort, "readCampaign">,
    applicationReviews: {
      readLatestHumanDecision: vi.fn().mockResolvedValue(overrides.decision ?? { ok: true, value: approvedDecision })
    } as unknown as Pick<ApplicationReviewRepositoryPort, "readLatestHumanDecision">,
    smeRequests: {
      findByApplicationId: vi
        .fn()
        .mockResolvedValue(overrides.request ?? { ok: true, value: { applicationId: APPLICATION_ID, request } })
    } as unknown as Pick<SmeRequestRepositoryPort, "findByApplicationId">,
    salesData: {
      getPeriods: vi.fn().mockResolvedValue(overrides.sales ?? { ok: true, value: series })
    } as unknown as Pick<SalesDataProviderPort, "getPeriods">
  };
}

const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const input = {
  applicationId: APPLICATION_ID,
  campaignId: CAMPAIGN_ID,
  sourceAccountId: SOURCE_ACCOUNT,
  correlationId: CORRELATION_ID
};

async function expectFailure(result: ReturnType<typeof deriveRevenueShareDistribution>, code: string) {
  const resolved = await result;
  expect(resolved).toEqual({ ok: false, error: { code } });
}

describe("deriveRevenueShareDistribution", () => {
  it("reproduces the canonical 2026-08 example: 3,745,800 ARS x 450 bps floor = 168,561 ARS", async () => {
    const result = await deriveRevenueShareDistribution(deps(), input);

    if (!result.ok) throw new Error("expected a derivation");
    expect(result.value.derivation.period).toBe("2026-08");
    expect(result.value.derivation.salesArs).toBe("3745800");
    expect(result.value.derivation.obligationArs).toBe("168561");
    expect(result.value.derivation.rateBps).toBe(450);
    expect(result.value.derivation.ruleVersion).toBe("RS-2026-01");
    expect(result.value.derivation.simulated).toBe(true);
  });

  it("converts the obligation to stroops in the proportion the campaign was funded", async () => {
    const result = await deriveRevenueShareDistribution(deps(), input);

    if (!result.ok) throw new Error("expected a derivation");
    // floor(168,561 x 1,000,000,000 / 5,000,000) = 168,561 x 200.
    expect(result.value.derivation.conversion).toEqual({
      goalStroops: "1000000000",
      approvedLimitArs: "5000000",
      totalStroops: "33712200"
    });
  });

  it("splits the converted obligation pro-rata by contribution and sums exactly", async () => {
    const result = await deriveRevenueShareDistribution(deps(), input);

    if (!result.ok) throw new Error("expected a derivation");
    expect(result.value.recipients).toEqual([
      { accountId: INVESTOR_A, amountStroops: 20_227_320n },
      { accountId: INVESTOR_B, amountStroops: 13_484_880n }
    ]);
    expect(result.value.recipients.reduce((sum, recipient) => sum + recipient.amountStroops, 0n)).toBe(33_712_200n);
  });

  it("uses the latest reported period even when a later period is anomalous or missing", async () => {
    const result = await deriveRevenueShareDistribution(
      deps({ sales: { ok: true, value: [...series, period("2026-09", 9_999_999, "anomalous")] } }),
      input
    );

    if (!result.ok) throw new Error("expected a derivation");
    expect(result.value.derivation.period).toBe("2026-08");
  });

  it("uses a newer reported period once the feed recorded it", async () => {
    const result = await deriveRevenueShareDistribution(
      deps({ sales: { ok: true, value: [...series, period("2026-09", 3_860_000)] } }),
      input
    );

    if (!result.ok) throw new Error("expected a derivation");
    expect(result.value.derivation.period).toBe("2026-09");
    // 3,860,000 x 450 / 10,000 = 173,700.
    expect(result.value.derivation.obligationArs).toBe("173700");
  });

  it("reports the periods that were not eligible instead of hiding them", async () => {
    const result = await deriveRevenueShareDistribution(deps(), input);

    if (!result.ok) throw new Error("expected a derivation");
    expect(result.value.derivation.excludedPeriods).toEqual([
      { period: "2026-04", status: "missing", reason: "missing_data" },
      { period: "2026-06", status: "anomalous", reason: "requires_review" }
    ]);
  });

  it("drops zero allocations: a recipient's amount must be positive", async () => {
    // B funded 1 stroop of 1,000,000,000: its pro-rata share of 33,712,200 rounds to 0.
    const result = await deriveRevenueShareDistribution(
      deps({
        contributions: {
          ok: true,
          value: [contribution(INVESTOR_A, 999_999_999n), contribution(INVESTOR_B, 1n)]
        }
      }),
      input
    );

    if (!result.ok) throw new Error("expected a derivation");
    expect(result.value.recipients).toEqual([{ accountId: INVESTOR_A, amountStroops: 33_712_200n }]);
  });

  it("never pays the source account: its allocation is dropped and the others keep their proportion", async () => {
    const result = await deriveRevenueShareDistribution(
      deps({
        contributions: {
          ok: true,
          value: [contribution(SOURCE_ACCOUNT, 100_000_000n), contribution(INVESTOR_A, 900_000_000n)]
        }
      }),
      input
    );

    if (!result.ok) throw new Error("expected a derivation");
    expect(result.value.recipients.map((recipient) => recipient.accountId)).toEqual([INVESTOR_A]);
    // 90 % of 33,712,200, exactly what A funded; the source's 10 % is not redistributed.
    expect(result.value.recipients[0]?.amountStroops).toBe(30_340_980n);
  });

  it("is deterministic: the same inputs derive the same recipients in the same order", async () => {
    const first = await deriveRevenueShareDistribution(deps(), input);
    const second = await deriveRevenueShareDistribution(deps(), input);

    expect(second).toEqual(first);
  });

  describe("typed failures", () => {
    it("reports an unknown campaign", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(deps({ campaign: { ok: false, error: { code: "not_found" } } }), input),
        "campaign_not_found"
      );
    });

    it("reports a campaign that belongs to another application", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(deps(), { ...input, applicationId: OTHER_APPLICATION_ID }),
        "application_mismatch"
      );
    });

    it.each(["open", "refundable"] as const)("refuses a %s campaign: only a settled one distributes", async (state) => {
      await expectFailure(
        deriveRevenueShareDistribution(deps({ campaign: { ok: true, value: { ...campaign, state } } }), input),
        "campaign_not_settled"
      );
    });

    it("reports an application without a recorded decision", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(deps({ decision: { ok: false, error: { code: "not_found" } } }), input),
        "decision_not_approved"
      );
    });

    it("reports a decision that is not an approval, or carries no positive limit", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(
          deps({ decision: { ok: true, value: { ...approvedDecision, outcome: "rejected", approvedLimitArs: null } } }),
          input
        ),
        "decision_not_approved"
      );
      await expectFailure(
        deriveRevenueShareDistribution(
          deps({ decision: { ok: true, value: { ...approvedDecision, approvedLimitArs: 0 } } }),
          input
        ),
        "decision_not_approved"
      );
    });

    it("reports an application whose request is unknown", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(deps({ request: { ok: false, error: { code: "not_found" } } }), input),
        "application_not_found"
      );
    });

    it("reports a series with no reported period, including an empty one", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(deps({ sales: { ok: true, value: [] } }), input),
        "no_eligible_period"
      );
      await expectFailure(
        deriveRevenueShareDistribution(
          deps({ sales: { ok: true, value: [period("2026-04", null, "missing"), period("2026-06", 1, "anomalous")] } }),
          input
        ),
        "no_eligible_period"
      );
    });

    it("treats a feed with no business for the reference as no eligible period", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(deps({ sales: { ok: false, error: { code: "not_found" } } }), input),
        "no_eligible_period"
      );
    });

    it("refuses a reported amount that is not a whole number of pesos", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(deps({ sales: { ok: true, value: [period("2026-08", 100.5)] } }), input),
        "invalid_sales_data"
      );
    });

    it("reports a campaign without contributors", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(deps({ contributions: { ok: true, value: [] } }), input),
        "no_contributors"
      );
    });

    it("refuses an incomplete contributor list: the mirror must add up to the campaign total", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(
          deps({ contributions: { ok: true, value: [contribution(INVESTOR_A, 600_000_000n)] } }),
          input
        ),
        "contributions_incomplete"
      );
    });

    it("reports an obligation that rounds to zero stroops", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(
          deps({
            decision: { ok: true, value: { ...approvedDecision, approvedLimitArs: Number.MAX_SAFE_INTEGER } },
            campaign: { ok: true, value: { ...campaign, goalStroops: 1_000n, totalStroops: 1_000n } },
            contributions: { ok: true, value: [contribution(INVESTOR_A, 1_000n)] }
          }),
          input
        ),
        "obligation_rounds_to_zero"
      );
    });

    it("reports a zero-sales period as an obligation that rounds to zero", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(deps({ sales: { ok: true, value: [period("2026-08", 0)] } }), input),
        "obligation_rounds_to_zero"
      );
    });

    it("refuses a source account that is not the campaign's SME account", async () => {
      await expectFailure(deriveRevenueShareDistribution(deps(), { ...input, sourceAccountId: INVESTOR_A }), "source_not_sme");
    });

    it("reconciles from the chain first: a mirror that still says open derives once the vault settled", async () => {
      const dependencies = deps({
        campaign: { ok: true, value: { ...campaign, state: "open", totalStroops: GOAL_STROOPS } },
        chain: {
          ok: true,
          value: {
            state: "settled",
            totalStroops: GOAL_STROOPS,
            goalStroops: GOAL_STROOPS,
            deadline: new Date(campaign.deadline),
            smeAccountId: SOURCE_ACCOUNT,
            tokenContractId: campaign.tokenContractAddress,
            observedAt: new Date("2026-09-30T13:00:00.000Z")
          }
        }
      });

      const result = await deriveRevenueShareDistribution(dependencies, input);

      expect(result.ok).toBe(true);
      expect(dependencies.campaigns.reconcile).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: CAMPAIGN_ID,
          correlationId: CORRELATION_ID,
          snapshot: expect.objectContaining({ state: "settled" })
        })
      );
    });

    it("refuses when the chain says the vault is not settled even though the mirror says settled", async () => {
      await expectFailure(
        deriveRevenueShareDistribution(
          deps({
            chain: {
              ok: true,
              value: {
                state: "funding",
                totalStroops: 0n,
                goalStroops: GOAL_STROOPS,
                deadline: new Date(campaign.deadline),
                smeAccountId: SOURCE_ACCOUNT,
                tokenContractId: campaign.tokenContractAddress,
                observedAt: new Date("2026-09-30T13:00:00.000Z")
              }
            }
          }),
          input
        ),
        "campaign_not_settled"
      );
    });

    it.each([
      ["the campaign read", { campaign: { ok: false, error: { code: "unavailable" } } }],
      ["the decision read", { decision: { ok: false, error: { code: "unavailable" } } }],
      ["the request read", { request: { ok: false, error: { code: "unavailable" } } }],
      ["the sales feed", { sales: { ok: false, error: { code: "unavailable" } } }],
      ["the contributions read", { contributions: { ok: false, error: { code: "unavailable" } } }],
      ["the chain read", { chain: { ok: false, error: { code: "unavailable" } } }],
      ["a chain read that finds no vault", { chain: { ok: false, error: { code: "not_found" } } }],
      ["the reconciliation", { reconcile: { ok: false, error: { code: "unavailable" } } }],
      ["a reconciliation that lost the race", { reconcile: { ok: false, error: { code: "state_conflict" } } }]
    ])("fails closed as unavailable when %s is unavailable", async (_description, overrides) => {
      await expectFailure(deriveRevenueShareDistribution(deps(overrides), input), "unavailable");
    });
  });
});

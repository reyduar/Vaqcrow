import {
  parseApplicationId,
  parseCorrelationId,
  parseRevenueShareDistributionId,
  parseSubmitRevenueShareDistributionCommand
} from "@vaqcrow/contracts";
import type { DistributionRecipient, RevenueShareDerivation } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { RevenueShareDistributionRepositoryPort } from "../ports/revenue-share-distribution-repository-port.js";
import type { RevenueShareDistributionXdrPort } from "../ports/revenue-share-distribution-xdr-port.js";
import type { DeriveRevenueShareDistributionResult } from "./derive-revenue-share-distribution.js";
import { submitRevenueShareDistribution } from "./submit-revenue-share-distribution.js";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
const DISTRIBUTION_ID = parseRevenueShareDistributionId("123e4567-e89b-42d3-a456-4266141740ab");
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const SOURCE_ACCOUNT = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const INVESTOR_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const INVESTOR_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const INVESTOR_C = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC".slice(0, 56);
const PASSPHRASE = "Test SDF Network ; September 2015";
const EXPLORER = "https://stellar.expert/explorer/testnet";
const HASH = "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";
const EXPIRES_AT = "2026-09-21T12:00:00.000Z";

const derivedRecipients: readonly DistributionRecipient[] = [
  { accountId: INVESTOR_A, amountStroops: 20_227_320n },
  { accountId: INVESTOR_B, amountStroops: 13_484_880n }
];

const derivation: RevenueShareDerivation = {
  ruleVersion: "RS-2026-01",
  rateBps: 450,
  period: "2026-08",
  salesArs: "3745800",
  obligationArs: "168561",
  excludedPeriods: [],
  conversion: { goalStroops: "1000000000", approvedLimitArs: "5000000", totalStroops: "33712200" },
  simulated: true
};

const derived: DeriveRevenueShareDistributionResult = { ok: true, value: { recipients: derivedRecipients, derivation } };

function commandWith(recipients: readonly DistributionRecipient[]) {
  return parseSubmitRevenueShareDistributionCommand({
    signedXdr: "AAAAsigned",
    terms: {
      network: "testnet",
      networkPassphrase: PASSPHRASE,
      sourceAccountId: SOURCE_ACCOUNT,
      sourceSequence: "1234567891",
      memo: null,
      expiresAt: EXPIRES_AT,
      recipients: recipients.map((recipient) => ({
        accountId: recipient.accountId,
        amountStroops: recipient.amountStroops.toString()
      }))
    },
    applicationId: APPLICATION_ID,
    campaignId: CAMPAIGN_ID
  });
}

const record = {
  distributionId: DISTRIBUTION_ID,
  network: "testnet",
  networkPassphrase: PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT,
  sourceSequence: "1234567891",
  recipients: derivedRecipients,
  expiresAt: EXPIRES_AT,
  signedXdr: "AAAAsigned",
  transactionHash: HASH,
  applicationId: APPLICATION_ID,
  campaignId: CAMPAIGN_ID,
  state: "submitted",
  lastCorrelationId: CORRELATION_ID,
  confirmationAttempts: 0,
  nextAttemptAt: "2026-09-21T12:00:10.000Z",
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
};

function setup(overrides: { derive?: DeriveRevenueShareDistributionResult; verify?: unknown } = {}) {
  const derive = vi.fn().mockResolvedValue(overrides.derive ?? derived);
  const xdr: RevenueShareDistributionXdrPort = {
    build: vi.fn(),
    verify: vi.fn().mockReturnValue(
      overrides.verify ?? {
        ok: true,
        value: {
          transactionHash: HASH,
          sourceAccountId: SOURCE_ACCOUNT,
          recipients: derivedRecipients,
          memo: null,
          expiresAt: EXPIRES_AT
        }
      }
    )
  };
  const repository: Pick<RevenueShareDistributionRepositoryPort, "submit"> = {
    submit: vi.fn().mockResolvedValue({ ok: true, value: { record, applied: true } })
  };

  return { deps: { xdr, repository, explorerBaseUrl: EXPLORER, derive }, derive, xdr, repository };
}

describe("submitRevenueShareDistribution", () => {
  it("re-derives the distribution from the case and persists it with the campaign link", async () => {
    const { deps, derive, repository } = setup();

    const result = await submitRevenueShareDistribution(deps, {
      distributionId: DISTRIBUTION_ID,
      command: commandWith(derivedRecipients),
      correlationId: CORRELATION_ID
    });

    expect(derive).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      campaignId: CAMPAIGN_ID,
      sourceAccountId: SOURCE_ACCOUNT
    });
    const saved = vi.mocked(repository.submit).mock.calls[0]?.[0].record;
    expect(saved?.campaignId).toBe(CAMPAIGN_ID);
    expect(saved?.applicationId).toBe(APPLICATION_ID);
    if (!result.ok) throw new Error("expected a submission");
    expect(result.value.applied).toBe(true);
    expect(result.value.distribution.campaignId).toBe(CAMPAIGN_ID);
  });

  it("accepts the derived recipients in any order", async () => {
    const { deps } = setup();

    const result = await submitRevenueShareDistribution(deps, {
      distributionId: DISTRIBUTION_ID,
      command: commandWith([...derivedRecipients].reverse()),
      correlationId: CORRELATION_ID
    });

    expect(result.ok).toBe(true);
  });

  it.each([
    [
      "an inflated amount",
      [
        { accountId: INVESTOR_A, amountStroops: 20_227_321n },
        { accountId: INVESTOR_B, amountStroops: 13_484_880n }
      ]
    ],
    ["a missing recipient", [{ accountId: INVESTOR_A, amountStroops: 20_227_320n }]],
    [
      "an extra recipient",
      [...derivedRecipients, { accountId: INVESTOR_C, amountStroops: 1n }]
    ],
    [
      "a different destination",
      [
        { accountId: INVESTOR_A, amountStroops: 20_227_320n },
        { accountId: INVESTOR_C, amountStroops: 13_484_880n }
      ]
    ]
  ])("rejects terms with %s as a derivation_mismatch, before verifying or persisting", async (_description, recipients) => {
    const { deps, xdr, repository } = setup();

    const result = await submitRevenueShareDistribution(deps, {
      distributionId: DISTRIBUTION_ID,
      command: commandWith(recipients),
      correlationId: CORRELATION_ID
    });

    expect(result).toEqual({ ok: false, error: { code: "derivation_mismatch" } });
    expect(xdr.verify).not.toHaveBeenCalled();
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it.each(["campaign_not_found", "campaign_not_settled", "contributions_incomplete"] as const)(
    "refuses a submission whose derivation fails (%s) without persisting",
    async (reason) => {
      const { deps, repository } = setup({ derive: { ok: false, error: { code: reason } } });

      const result = await submitRevenueShareDistribution(deps, {
        distributionId: DISTRIBUTION_ID,
        command: commandWith(derivedRecipients),
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "derivation_failed", reason } });
      expect(repository.submit).not.toHaveBeenCalled();
    }
  );

  it("maps an unavailable derivation to unavailable", async () => {
    const { deps } = setup({ derive: { ok: false, error: { code: "unavailable" } } });

    const result = await submitRevenueShareDistribution(deps, {
      distributionId: DISTRIBUTION_ID,
      command: commandWith(derivedRecipients),
      correlationId: CORRELATION_ID
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("still refuses an envelope that does not match the declared terms", async () => {
    const { deps, repository } = setup({
      verify: { ok: false, error: { code: "intent_mismatch", reason: "recipients" } }
    });

    const result = await submitRevenueShareDistribution(deps, {
      distributionId: DISTRIBUTION_ID,
      command: commandWith(derivedRecipients),
      correlationId: CORRELATION_ID
    });

    expect(result).toEqual({ ok: false, error: { code: "xdr_rejected", reason: "recipients" } });
    expect(repository.submit).not.toHaveBeenCalled();
  });
});

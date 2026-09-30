import { parseApplicationId, parseCorrelationId, parseRevenueShareDistributionId } from "@vaqcrow/contracts";
import type { DistributionRecipient, RevenueShareDerivation } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { LedgerPort } from "../ports/ledger-port.js";
import type { RevenueShareDistributionXdrPort } from "../ports/revenue-share-distribution-xdr-port.js";
import type { DeriveRevenueShareDistributionResult } from "./derive-revenue-share-distribution.js";
import { prepareRevenueShareDistribution } from "./prepare-revenue-share-distribution.js";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
const DISTRIBUTION_ID = parseRevenueShareDistributionId("123e4567-e89b-42d3-a456-4266141740ab");
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const SOURCE_ACCOUNT = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const INVESTOR_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const INVESTOR_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const PASSPHRASE = "Test SDF Network ; September 2015";

const recipients: readonly DistributionRecipient[] = [
  { accountId: INVESTOR_A, amountStroops: 20_227_320n },
  { accountId: INVESTOR_B, amountStroops: 13_484_880n }
];

const derivation: RevenueShareDerivation = {
  ruleVersion: "RS-2026-01",
  rateBps: 450,
  period: "2026-08",
  salesArs: "3745800",
  obligationArs: "168561",
  excludedPeriods: [{ period: "2026-04", status: "missing", reason: "missing_data" }],
  conversion: { goalStroops: "1000000000", approvedLimitArs: "5000000", totalStroops: "33712200" },
  simulated: true
};

const derived: DeriveRevenueShareDistributionResult = { ok: true, value: { recipients, derivation } };

const command = {
  sourceAccountId: SOURCE_ACCOUNT,
  applicationId: APPLICATION_ID,
  campaignId: CAMPAIGN_ID,
  memo: null
};

function setup(
  overrides: {
    derive?: DeriveRevenueShareDistributionResult;
    ledger?: Awaited<ReturnType<LedgerPort["getAccount"]>>;
    build?: ReturnType<RevenueShareDistributionXdrPort["build"]>;
  } = {}
) {
  const derive = vi.fn().mockResolvedValue(overrides.derive ?? derived);
  const ledger: LedgerPort = {
    getAccount: vi
      .fn()
      .mockResolvedValue(
        overrides.ledger ?? {
          ok: true,
          value: { accountId: SOURCE_ACCOUNT, sequence: "1234567890", nativeBalanceStroops: 50_000_000n }
        }
      )
  };
  const xdr: RevenueShareDistributionXdrPort = {
    build: vi.fn().mockImplementation(({ terms }) =>
      overrides.build ?? {
        ok: true,
        value: {
          xdr: "AAAAunsigned",
          networkPassphrase: PASSPHRASE,
          sourceAccountId: terms.sourceAccountId,
          sourceSequence: "1234567891",
          recipients: terms.recipients,
          memo: terms.memo,
          expiresAt: terms.expiresAt
        }
      }
    ),
    verify: vi.fn()
  };
  const deps = {
    ledger,
    xdr,
    network: { network: "testnet", networkPassphrase: PASSPHRASE },
    generateDistributionId: () => DISTRIBUTION_ID,
    derive
  };

  return { deps, derive, ledger, xdr };
}

describe("prepareRevenueShareDistribution", () => {
  it("derives the recipients server-side and builds the envelope from them", async () => {
    const { deps, derive, xdr } = setup();

    const result = await prepareRevenueShareDistribution(deps, { command, correlationId: CORRELATION_ID });

    expect(derive).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      campaignId: CAMPAIGN_ID,
      sourceAccountId: SOURCE_ACCOUNT
    });
    expect(vi.mocked(xdr.build).mock.calls[0]?.[0].terms.recipients).toEqual(recipients);
    if (!result.ok) throw new Error("expected a prepared distribution");
    expect(result.value.recipients).toEqual(recipients);
  });

  it("returns the case ids and the derivation alongside the prepared terms", async () => {
    const { deps } = setup();

    const result = await prepareRevenueShareDistribution(deps, { command, correlationId: CORRELATION_ID });

    if (!result.ok) throw new Error("expected a prepared distribution");
    expect(result.value.applicationId).toBe(APPLICATION_ID);
    expect(result.value.campaignId).toBe(CAMPAIGN_ID);
    expect(result.value.derivation).toEqual(derivation);
    expect(result.value.distributionId).toBe(DISTRIBUTION_ID);
    expect(result.value.xdr).toBe("AAAAunsigned");
  });

  it.each([
    "campaign_not_found",
    "application_mismatch",
    "campaign_not_settled",
    "decision_not_approved",
    "application_not_found",
    "no_eligible_period",
    "invalid_sales_data",
    "no_contributors",
    "contributions_incomplete",
    "obligation_rounds_to_zero"
  ] as const)("reports a failed derivation (%s) and never reaches the ledger or the builder", async (reason) => {
    const { deps, ledger, xdr } = setup({ derive: { ok: false, error: { code: reason } } });

    const result = await prepareRevenueShareDistribution(deps, { command, correlationId: CORRELATION_ID });

    expect(result).toEqual({ ok: false, error: { code: "derivation_failed", reason } });
    expect(ledger.getAccount).not.toHaveBeenCalled();
    expect(xdr.build).not.toHaveBeenCalled();
  });

  it("maps an unavailable derivation to unavailable", async () => {
    const { deps } = setup({ derive: { ok: false, error: { code: "unavailable" } } });

    const result = await prepareRevenueShareDistribution(deps, { command, correlationId: CORRELATION_ID });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps an unfunded source account to account_not_found", async () => {
    const { deps } = setup({ ledger: { ok: false, error: { code: "not_found" } } });

    const result = await prepareRevenueShareDistribution(deps, { command, correlationId: CORRELATION_ID });

    expect(result).toEqual({ ok: false, error: { code: "account_not_found" } });
  });

  it("maps an unbuildable envelope to invalid_input", async () => {
    const { deps } = setup({ build: { ok: false, error: { code: "invalid_input" } } });

    const result = await prepareRevenueShareDistribution(deps, { command, correlationId: CORRELATION_ID });

    expect(result).toEqual({ ok: false, error: { code: "invalid_input" } });
  });
});

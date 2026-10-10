import { describe, expect, it } from "vitest";
import { WalletError } from "@/application/ports/wallet-port";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import type { PreparedRevenueShareDistribution } from "@vaqcrow/contracts";
import {
  DISTRIBUTION_SIGNING_FAILURE_KINDS,
  distributionReviewRows,
  distributionSigningFailureOfError,
  distributionSigningFailureOfKind,
  toDistributionSigningFailure,
  totalRecipientStroops
} from "./distribution-signing";

const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";

function campaign(overrides: Partial<MyCampaign> = {}): MyCampaign {
  return {
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    name: "Campaña 2026 · Panadería Horizonte",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    vaultAddress: VAULT,
    vaultExplorerUrl: null,
    state: "settled",
    goalArs: 15_000_000,
    raisedArs: 15_000_000,
    fundedPercentBps: 10_000,
    deadline: "2026-11-30T12:00:00.000Z",
    contributorsCount: 38,
    distributions: [],
    sales: [],
    ...overrides
  };
}

function prepared(overrides: Partial<PreparedRevenueShareDistribution> = {}): PreparedRevenueShareDistribution {
  return {
    distributionId: "123e4567-e89b-42d3-a456-4266141740ab",
    network: "testnet",
    networkPassphrase: "test-network-id",
    sourceAccountId: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    sourceSequence: "1234567891",
    recipients: [
      { accountId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", amountStroops: 20_227_320n },
      { accountId: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", amountStroops: 13_484_880n }
    ],
    memo: null,
    expiresAt: "2026-09-21T12:15:00.000Z",
    xdr: "UNSIGNED-XDR",
    applicationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    derivation: {
      ruleVersion: "RS-2026-01",
      rateBps: 450,
      period: "2026-08",
      salesArs: "3745800",
      obligationArs: "168561",
      excludedPeriods: [],
      conversion: { goalStroops: "1000000000", approvedLimitArs: "5000000", totalStroops: "33712200" },
      simulated: true
    },
    ...overrides
  } as unknown as PreparedRevenueShareDistribution;
}

describe("distributionSigningFailureOfKind", () => {
  it("maps every known kind to a non-empty sentence", () => {
    for (const kind of DISTRIBUTION_SIGNING_FAILURE_KINDS) {
      // `derivation_failed` always carries a reason and is composed from it.
      if (kind === "derivation_failed") continue;
      const failure = distributionSigningFailureOfKind(kind);
      expect(failure.kind).toBe(kind);
      expect(failure.message.trim().length).toBeGreaterThan(0);
    }
  });

  it("says a declined signature sent nothing and is retryable", () => {
    expect(distributionSigningFailureOfKind("wallet_rejected").message).toMatch(/Rechaz/i);
  });

  it("blocks signing honestly when the application identity could not be resolved", () => {
    expect(distributionSigningFailureOfKind("identity_unavailable").message).toMatch(/solicitud/i);
  });
});

describe("distributionSigningFailureOfError", () => {
  it("names the derivation reason instead of a coarse kind", () => {
    const failure = distributionSigningFailureOfError({ kind: "derivation_failed", reason: "source_not_sme" });
    expect(failure.kind).toBe("derivation_failed");
    expect(failure.message).toMatch(/solo esa cuenta puede firmar/i);
  });

  it("keeps a coarse gateway kind", () => {
    const failure = distributionSigningFailureOfError({ kind: "not_found" });
    expect(failure.kind).toBe("not_found");
  });
});

describe("toDistributionSigningFailure", () => {
  it("classifies a wallet rejection by its kind, never by its message", () => {
    const failure = toDistributionSigningFailure(new WalletError("rejected", "The user rejected this request."));
    expect(failure.kind).toBe("wallet_rejected");
  });

  it("classifies a wrong-network wallet as its own kind", () => {
    expect(toDistributionSigningFailure(new WalletError("network_mismatch", "wrong network")).kind).toBe(
      "wallet_network_mismatch"
    );
  });

  it("falls back to unknown for anything else", () => {
    expect(toDistributionSigningFailure(new Error("boom")).kind).toBe("unknown");
  });
});

describe("totalRecipientStroops", () => {
  it("sums the service's own amounts", () => {
    expect(totalRecipientStroops(prepared().recipients)).toBe(33_712_200n);
  });

  it("is zero for no recipients", () => {
    expect(totalRecipientStroops([])).toBe(0n);
  });
});

describe("distributionReviewRows", () => {
  it("names the contract, the function and the custody note", () => {
    const rows = distributionReviewRows(campaign());
    expect(rows.map((row) => row.label)).toEqual(["Contrato", "Función", "Custodia"]);
    expect(rows[0]).toEqual({ label: "Contrato", value: VAULT, mono: true });
    expect(rows[1]?.value).toMatch(/Distribución/i);
    expect(rows[2]?.value).toMatch(/custodial/i);
  });
});

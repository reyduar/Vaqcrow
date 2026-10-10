import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import type { RevenueShareDistributionGateway } from "@/application/ports/revenue-share-distribution-gateway";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { WalletError } from "@/application/ports/wallet-port";
import type { PreparedRevenueShareDistribution, RevenueShareDistributionSnapshot } from "@vaqcrow/contracts";
import { useCompanyDistributionSigning } from "./use-company-distribution-signing";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const DISTRIBUTION_ID = "123e4567-e89b-42d3-a456-4266141740ab";
const CORRELATION_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const PASSPHRASE = "passphrase-from-the-response";

function campaign(overrides: Partial<MyCampaign> = {}): MyCampaign {
  return {
    campaignId: CAMPAIGN_ID,
    name: "Panadería Horizonte",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
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

const prepared = {
  distributionId: DISTRIBUTION_ID,
  network: "testnet",
  networkPassphrase: PASSPHRASE,
  sourceAccountId: SOURCE,
  sourceSequence: "1234567891",
  recipients: [{ accountId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", amountStroops: 33_712_200n }],
  memo: null,
  expiresAt: "2026-09-21T12:15:00.000Z",
  xdr: "UNSIGNED-XDR",
  applicationId: APPLICATION_ID,
  campaignId: CAMPAIGN_ID,
  derivation: {
    ruleVersion: "RS-2026-01",
    rateBps: 450,
    period: "2026-08",
    salesArs: "3745800",
    obligationArs: "168561",
    excludedPeriods: [],
    conversion: { goalStroops: "1000000000", approvedLimitArs: "5000000", totalStroops: "33712200" },
    simulated: true
  }
} as unknown as PreparedRevenueShareDistribution;

const snapshot = {
  ...prepared,
  state: "submitted",
  transactionHash: "TRANSACTION-HASH",
  explorerUrl: "https://stellar.expert/explorer/testnet/tx/TRANSACTION-HASH",
  failureReason: null,
  lastCorrelationId: CORRELATION_ID,
  period: "2026-08",
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
} as unknown as RevenueShareDistributionSnapshot;

function createGateway(overrides: Partial<RevenueShareDistributionGateway> = {}): RevenueShareDistributionGateway {
  return {
    prepare: vi.fn().mockResolvedValue({ ok: true, value: prepared }),
    submit: vi.fn().mockResolvedValue({ ok: true, value: { applied: true, distribution: snapshot } }),
    getStatus: vi.fn().mockResolvedValue({ ok: true, value: snapshot }),
    ...overrides
  } as unknown as RevenueShareDistributionGateway;
}

function createWallet(overrides: Partial<WalletPort> = {}): WalletPort {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    connect: vi.fn().mockResolvedValue({ publicKey: SOURCE }),
    signTransaction: vi.fn().mockResolvedValue("SIGNED-XDR"),
    signMessage: vi.fn().mockResolvedValue("SIGNATURE"),
    ...overrides
  } as unknown as WalletPort;
}

function createConnection(publicKey: string | null = SOURCE): WalletConnectionPort {
  return {
    requestChallenge: vi.fn(),
    submitConnection: vi.fn(),
    getConnection: vi.fn().mockResolvedValue({ ok: true, publicKey, frozen: false })
  } as unknown as WalletConnectionPort;
}

function setup(overrides: Partial<Parameters<typeof useCompanyDistributionSigning>[0]> = {}) {
  const gateway = overrides.gateway === undefined ? createGateway() : overrides.gateway;
  const wallet = overrides.wallet === undefined ? createWallet() : overrides.wallet;
  const connection = overrides.connection === undefined ? createConnection() : overrides.connection;
  const applicationId = overrides.applicationId === undefined ? APPLICATION_ID : overrides.applicationId;
  const onSigned = overrides.onSigned ?? vi.fn();
  const view = renderHook(() =>
    useCompanyDistributionSigning({ gateway, wallet, connection, applicationId, onSigned })
  );
  return { ...view, gateway: gateway as RevenueShareDistributionGateway, wallet, connection, onSigned };
}

describe("useCompanyDistributionSigning", () => {
  it("fails closed with no gateway and never prepares", async () => {
    const { result } = setup({ gateway: null });
    await act(async () => {
      await result.current.start(campaign());
    });
    expect(result.current.failure?.kind).toBe("unavailable");
    expect(result.current.isReviewOpen).toBe(false);
  });

  it("fails closed when the application identity is missing and never prepares", async () => {
    const { result, gateway } = setup({ applicationId: null });
    await act(async () => {
      await result.current.start(campaign());
    });
    expect(result.current.failure?.kind).toBe("identity_unavailable");
    expect(gateway.prepare).not.toHaveBeenCalled();
  });

  it("fails closed when the PyME has no connected wallet and never prepares", async () => {
    const { result, gateway } = setup({ connection: createConnection(null) });
    await act(async () => {
      await result.current.start(campaign());
    });
    expect(result.current.failure?.kind).toBe("not_connected");
    expect(gateway.prepare).not.toHaveBeenCalled();
  });

  it("prepares for the campaign with the persisted SME account as source, and signs only on demand", async () => {
    const { result, gateway, wallet } = setup();
    await act(async () => {
      await result.current.start(campaign());
    });

    expect(gateway.prepare).toHaveBeenCalledWith({
      sourceAccountId: SOURCE,
      applicationId: APPLICATION_ID,
      campaignId: CAMPAIGN_ID,
      memo: null
    });
    expect(result.current.isReviewOpen).toBe(true);
    expect(wallet.signTransaction).not.toHaveBeenCalled();
  });

  it("signs the prepared envelope with the passphrase the service returned, submits, and signals the dashboard", async () => {
    const { result, gateway, wallet, onSigned } = setup();
    await act(async () => {
      await result.current.start(campaign());
    });
    await act(async () => {
      await result.current.sign();
    });

    expect(wallet.signTransaction).toHaveBeenCalledWith("UNSIGNED-XDR", PASSPHRASE);
    expect(gateway.submit).toHaveBeenCalledWith(
      expect.objectContaining({ distributionId: DISTRIBUTION_ID, signedXdr: "SIGNED-XDR", applicationId: APPLICATION_ID, campaignId: CAMPAIGN_ID })
    );
    expect(result.current.snapshot).toEqual(snapshot);
    expect(result.current.isReviewOpen).toBe(false);
    expect(onSigned).toHaveBeenCalledTimes(1);
  });

  it("surfaces a rejected signature truthfully, keeps the prepared distribution, and never submits", async () => {
    const signTransaction = vi.fn().mockRejectedValue(new WalletError("rejected", "The user rejected this request."));
    const { result, gateway } = setup({ wallet: createWallet({ signTransaction }) });
    await act(async () => {
      await result.current.start(campaign());
    });
    await act(async () => {
      await result.current.sign();
    });

    expect(result.current.failure?.kind).toBe("wallet_rejected");
    expect(result.current.prepared).toBe(prepared);
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  it("never reaches the wallet when the service refuses the preparation", async () => {
    const gateway = createGateway({
      prepare: vi.fn().mockResolvedValue({ ok: false, error: { kind: "not_found" } })
    });
    const { result, wallet } = setup({ gateway });
    await act(async () => {
      await result.current.start(campaign());
    });

    expect(result.current.failure?.kind).toBe("not_found");
    expect(result.current.isReviewOpen).toBe(false);
    expect(wallet.signTransaction).not.toHaveBeenCalled();
  });

  it("refreshes the persisted status on demand", async () => {
    const confirmed = { ...snapshot, state: "confirmed" } as unknown as RevenueShareDistributionSnapshot;
    const gateway = createGateway({ getStatus: vi.fn().mockResolvedValue({ ok: true, value: confirmed }) });
    const { result } = setup({ gateway });
    await act(async () => {
      await result.current.start(campaign());
    });
    await act(async () => {
      await result.current.sign();
    });
    await act(async () => {
      await result.current.refreshStatus();
    });

    await waitFor(() => expect(result.current.snapshot?.state).toBe("confirmed"));
  });
});

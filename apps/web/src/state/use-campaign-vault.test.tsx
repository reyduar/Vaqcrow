import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { WalletError } from "@/application/ports/wallet-port";
import type { CampaignSnapshot } from "@vaqcrow/contracts";
import { useCampaignVault } from "./use-campaign-vault";

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const APPLICATION_ID = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const SME = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const INVESTOR = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const OTHER_INVESTOR = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const CONTRACT = "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
const HASH = "TRANSACTION-HASH";

function snapshot(overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot {
  return {
    campaignId: CAMPAIGN_ID,
    applicationId: APPLICATION_ID,
    contractAddress: CONTRACT,
    network: "TESTNET",
    state: "funding",
    goalStroops: 50000000n,
    totalStroops: 0n,
    deadline: "2026-12-01T00:00:00.000Z",
    smeAccountId: SME,
    reconciliationStatus: "in_sync",
    ...overrides
  } as unknown as CampaignSnapshot;
}

function createGateway(overrides: Partial<CampaignGateway> = {}): CampaignGateway {
  return {
    openCampaign: vi.fn().mockResolvedValue({ applied: true, campaign: snapshot() }),
    getCampaign: vi.fn().mockResolvedValue(snapshot()),
    prepareInvocation: vi.fn().mockResolvedValue({
      invocationId: "22222222-2222-4222-8222-222222222222",
      operation: "contribute",
      xdr: "UNSIGNED-XDR",
      networkPassphrase: "passphrase",
      expiresAt: "2026-09-21T12:15:00.000Z"
    }),
    submitInvocation: vi.fn().mockResolvedValue({ transactionHash: HASH, status: "accepted" }),
    getTransaction: vi.fn().mockResolvedValue({ transactionHash: HASH, status: "success", campaign: snapshot({ totalStroops: 15000000n }) }),
    ...overrides
  } as unknown as CampaignGateway;
}

function createWallet(overrides: Partial<WalletPort> = {}): WalletPort {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    connect: vi.fn().mockResolvedValue({ publicKey: INVESTOR }),
    signTransaction: vi.fn().mockResolvedValue("SIGNED-XDR"),
    ...overrides
  } as unknown as WalletPort;
}

async function renderConnected(gateway: CampaignGateway, wallet: WalletPort, campaignId: string | null = CAMPAIGN_ID) {
  const rendered = renderHook(() =>
    useCampaignVault(gateway, wallet, campaignId, { pollIntervalMs: 0, maxPollAttempts: 3 })
  );
  await act(() => rendered.result.current.connect());
  return rendered;
}

describe("useCampaignVault: loading the campaign", () => {
  it("loads the campaign snapshot from the API when a campaign id is given", async () => {
    const gateway = createGateway();
    const { result } = renderHook(() =>
      useCampaignVault(gateway, createWallet(), CAMPAIGN_ID, { pollIntervalMs: 0 })
    );

    await waitFor(() => expect(result.current.campaign?.campaignId).toBe(CAMPAIGN_ID));
    expect(gateway.getCampaign).toHaveBeenCalledWith(CAMPAIGN_ID, undefined);
  });

  it("never loads a campaign when no id is known yet", async () => {
    const gateway = createGateway();
    renderHook(() => useCampaignVault(gateway, createWallet(), null, { pollIntervalMs: 0 }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(gateway.getCampaign).not.toHaveBeenCalled();
  });

  it("re-reads with the investor's own address once the wallet connects", async () => {
    const gateway = createGateway();
    await renderConnected(gateway, createWallet());

    await waitFor(() => expect(gateway.getCampaign).toHaveBeenCalledWith(CAMPAIGN_ID, INVESTOR));
  });
});

describe("useCampaignVault: opening the vault", () => {
  it("opens the campaign with the connected wallet as the SME's account", async () => {
    const gateway = createGateway({ openCampaign: vi.fn().mockResolvedValue({ applied: true, campaign: snapshot() }) });
    const { result } = await renderConnected(gateway, createWallet(), null);

    let campaignId: string | undefined;
    await act(async () => {
      campaignId = await result.current.openCampaign({
        applicationId: APPLICATION_ID,
        goalStroops: "50000000",
        deadline: "2026-12-01T00:00:00.000Z"
      });
    });

    expect(gateway.openCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ smeAccountId: INVESTOR, applicationId: APPLICATION_ID })
    );
    expect(campaignId).toBe(CAMPAIGN_ID);
    expect(result.current.campaign?.campaignId).toBe(CAMPAIGN_ID);
  });

  it("reports the SME account being unavailable as a blocked pre-open state, not a payout failure", async () => {
    const openCampaign = vi
      .fn()
      .mockRejectedValue(new HttpClientError("http", 422, undefined, "sme_account_unavailable"));
    const gateway = createGateway({ openCampaign });
    const { result } = await renderConnected(gateway, createWallet(), null);

    await act(async () => {
      await result.current.openCampaign({
        applicationId: APPLICATION_ID,
        goalStroops: "50000000",
        deadline: "2026-12-01T00:00:00.000Z"
      });
    });

    expect(result.current.error?.kind).toBe("sme_account_unavailable");
    expect(result.current.campaign).toBeUndefined();
  });

  it("refuses to open before the SME connects a wallet", async () => {
    const gateway = createGateway();
    const { result } = renderHook(() => useCampaignVault(gateway, createWallet(), null, { pollIntervalMs: 0 }));

    await act(async () => {
      await result.current.openCampaign({
        applicationId: APPLICATION_ID,
        goalStroops: "50000000",
        deadline: "2026-12-01T00:00:00.000Z"
      });
    });

    expect(result.current.error?.kind).toBe("not_connected");
    expect(gateway.openCampaign).not.toHaveBeenCalled();
  });
});

describe("useCampaignVault: contributing", () => {
  it("prepares, signs with the response's own passphrase, submits, polls and refreshes", async () => {
    const signTransaction = vi.fn().mockResolvedValue("SIGNED-XDR");
    const gateway = createGateway();
    const { result } = await renderConnected(gateway, createWallet({ signTransaction }));

    await act(() => result.current.contribute("15000000"));

    expect(gateway.prepareInvocation).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      expect.objectContaining({ operation: "contribute", investorAccountId: INVESTOR, amountStroops: 15000000n })
    );
    expect(signTransaction).toHaveBeenCalledWith("UNSIGNED-XDR", "passphrase");
    expect(gateway.submitInvocation).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      expect.objectContaining({ signedXdr: "SIGNED-XDR" })
    );
    expect(gateway.getTransaction).toHaveBeenCalledWith(CAMPAIGN_ID, HASH);
    expect(result.current.campaign?.totalStroops).toBe(15000000n);
    expect(result.current.error).toBeUndefined();
  });

  it("refuses to contribute before a wallet is connected", async () => {
    const gateway = createGateway();
    const { result } = renderHook(() => useCampaignVault(gateway, createWallet(), CAMPAIGN_ID, { pollIntervalMs: 0 }));

    await act(() => result.current.contribute("15000000"));

    expect(result.current.error?.kind).toBe("not_connected");
    expect(gateway.prepareInvocation).not.toHaveBeenCalled();
  });

  it("reports a declined signature as wallet_rejected", async () => {
    const signTransaction = vi.fn().mockRejectedValue(new WalletError("rejected", "The user rejected this request."));
    const gateway = createGateway();
    const { result } = await renderConnected(gateway, createWallet({ signTransaction }));

    await act(() => result.current.contribute("15000000"));

    expect(result.current.error?.kind).toBe("wallet_rejected");
    expect(gateway.submitInvocation).not.toHaveBeenCalled();
  });

  it("reports a wallet on another network as wallet_network_mismatch", async () => {
    const signTransaction = vi.fn().mockRejectedValue(new WalletError("network_mismatch", "another network"));
    const gateway = createGateway();
    const { result } = await renderConnected(gateway, createWallet({ signTransaction }));

    await act(() => result.current.contribute("15000000"));

    expect(result.current.error?.kind).toBe("wallet_network_mismatch");
  });

  it("reports the chain refusing a late contribution as not_funding", async () => {
    const prepareInvocation = vi.fn().mockRejectedValue(new HttpClientError("http", 409, undefined, "campaign_not_funding"));
    const gateway = createGateway({ prepareInvocation });
    const { result } = await renderConnected(gateway, createWallet());

    await act(() => result.current.contribute("15000000"));

    expect(result.current.error?.kind).toBe("not_funding");
  });

  it("ignores a second contribute while one is in flight", async () => {
    let resolvePrepare!: (value: unknown) => void;
    const prepareInvocation = vi.fn().mockReturnValue(new Promise((resolve) => (resolvePrepare = resolve)));
    const gateway = createGateway({ prepareInvocation });
    const { result } = await renderConnected(gateway, createWallet());

    let first!: Promise<void>;
    act(() => {
      first = result.current.contribute("15000000");
      void result.current.contribute("15000000");
    });
    expect(prepareInvocation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePrepare({
        invocationId: "22222222-2222-4222-8222-222222222222",
        operation: "contribute",
        xdr: "UNSIGNED-XDR",
        networkPassphrase: "passphrase",
        expiresAt: "2026-09-21T12:15:00.000Z"
      });
      await first;
    });
    expect(gateway.submitInvocation).toHaveBeenCalledTimes(1);
  });

  it("reports a reverted contribution (poll status failed) as refused, without leaving the campaign stuck loading", async () => {
    const getTransaction = vi.fn().mockResolvedValue({ transactionHash: HASH, status: "failed" });
    const gateway = createGateway({ getTransaction });
    const { result } = await renderConnected(gateway, createWallet());

    await act(() => result.current.contribute("15000000"));

    expect(result.current.error?.kind).toBe("refused");
    // The chain-observed snapshot is unchanged (still funding): nothing claims the contribution succeeded.
    expect(result.current.campaign?.state).toBe("funding");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("reports a bounded poll timeout as unavailable, without hanging forever", async () => {
    const getTransaction = vi.fn().mockResolvedValue({ transactionHash: HASH, status: "pending" });
    const gateway = createGateway({ getTransaction });
    const { result } = await renderConnected(gateway, createWallet());

    await act(() => result.current.contribute("15000000"));

    expect(getTransaction).toHaveBeenCalledTimes(3);
    expect(result.current.error?.kind).toBe("unavailable");
  });
});

describe("useCampaignVault: withdrawing", () => {
  it("prepares a withdraw with no amount, for the connected investor", async () => {
    const gateway = createGateway();
    const { result } = await renderConnected(gateway, createWallet());

    await act(() => result.current.withdraw());

    expect(gateway.prepareInvocation).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      expect.objectContaining({ operation: "withdraw", investorAccountId: INVESTOR, amountStroops: null })
    );
  });
});

describe("useCampaignVault: refunding", () => {
  it("refunds the connected wallet's own contribution by default", async () => {
    const gateway = createGateway();
    const { result } = await renderConnected(gateway, createWallet());

    await act(() => result.current.refund());

    expect(gateway.prepareInvocation).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      expect.objectContaining({ operation: "refund", investorAccountId: INVESTOR })
    );
  });

  it("lets the connected wallet trigger a refund for another investor's registered address", async () => {
    const gateway = createGateway();
    const { result } = await renderConnected(gateway, createWallet());

    await act(() => result.current.refund(OTHER_INVESTOR));

    expect(gateway.prepareInvocation).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      expect.objectContaining({ operation: "refund", investorAccountId: OTHER_INVESTOR, sourceAccountId: INVESTOR })
    );
  });
});

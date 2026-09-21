import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { FundingIntentGateway } from "@/application/ports/funding-intent-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { WalletError } from "@/application/ports/wallet-port";
import type { FundingIntentSnapshot, PreparedFundingIntent } from "@vaqcrow/contracts";
import { useFundingIntent, type FundingIntentDraft } from "./use-funding-intent";

const INTENT_ID = "11111111-1111-4111-8111-111111111111";
const CORRELATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
/** Deliberately not a real network passphrase: the web must never own one. */
const RESPONSE_PASSPHRASE = "passphrase-from-the-response";
const SOURCE = "GSOURCEACCOUNT";
const DEST = "GDESTINATIONACCOUNT";

const draft: FundingIntentDraft = { destinationAccountId: DEST, amountStroops: "15000000", memo: null };

const prepared = {
  intentId: INTENT_ID,
  network: "TESTNET",
  networkPassphrase: RESPONSE_PASSPHRASE,
  sourceAccountId: SOURCE,
  sourceSequence: "12",
  destinationAccountId: DEST,
  amountStroops: 15000000n,
  memo: null,
  expiresAt: "2026-09-21T12:15:00.000Z",
  xdr: "UNSIGNED-XDR",
  applicationId: null
} as unknown as PreparedFundingIntent;

const snapshot = {
  intentId: INTENT_ID,
  network: "TESTNET",
  networkPassphrase: RESPONSE_PASSPHRASE,
  sourceAccountId: SOURCE,
  sourceSequence: "12",
  destinationAccountId: DEST,
  amountStroops: 15000000n,
  memo: null,
  expiresAt: "2026-09-21T12:15:00.000Z",
  state: "submitted",
  transactionHash: "TRANSACTION-HASH",
  applicationId: null,
  lastCorrelationId: CORRELATION_ID,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:00.000Z"
} as unknown as FundingIntentSnapshot;

function createGateway(overrides: Partial<FundingIntentGateway> = {}): FundingIntentGateway {
  return {
    prepare: vi.fn().mockResolvedValue(prepared),
    submit: vi.fn().mockResolvedValue({ applied: true, intent: snapshot }),
    get: vi.fn().mockResolvedValue(snapshot),
    ...overrides
  } as unknown as FundingIntentGateway;
}

function createWallet(overrides: Partial<WalletPort> = {}): WalletPort {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    connect: vi.fn().mockResolvedValue({ publicKey: SOURCE }),
    signTransaction: vi.fn().mockResolvedValue("SIGNED-XDR"),
    ...overrides
  } as unknown as WalletPort;
}

async function renderConnected(gateway: FundingIntentGateway | null, wallet: WalletPort) {
  const rendered = renderHook(() => useFundingIntent(gateway, wallet, null));
  await act(() => rendered.result.current.connect());
  return rendered;
}

describe("useFundingIntent", () => {
  it("signs with the passphrase the prepare response returned, never a constant of the web's own", async () => {
    const signTransaction = vi.fn().mockResolvedValue("SIGNED-XDR");
    const gateway = createGateway();
    const { result } = await renderConnected(gateway, createWallet({ signTransaction }));

    await act(() => result.current.submit(draft));

    expect(signTransaction).toHaveBeenCalledWith("UNSIGNED-XDR", RESPONSE_PASSPHRASE);
    expect(result.current.result?.applied).toBe(true);
  });

  it("submits the response's declared terms back to the API", async () => {
    const submit = vi.fn().mockResolvedValue({ applied: true, intent: snapshot });
    const gateway = createGateway({ submit });
    const { result } = await renderConnected(gateway, createWallet());

    await act(() => result.current.submit(draft));

    expect(submit).toHaveBeenCalledWith(
      INTENT_ID,
      expect.objectContaining({
        signedXdr: "SIGNED-XDR",
        applicationId: null,
        intent: expect.objectContaining({
          networkPassphrase: RESPONSE_PASSPHRASE,
          amountStroops: 15000000n,
          sourceAccountId: SOURCE,
          destinationAccountId: DEST
        })
      })
    );
  });

  it("keeps the prepared intent intact after a wallet rejection and reports it as recoverable", async () => {
    const signTransaction = vi
      .fn()
      .mockRejectedValueOnce(new WalletError("rejected", "The user rejected this request."))
      .mockResolvedValueOnce("SIGNED-XDR");
    const prepare = vi.fn().mockResolvedValue(prepared);
    const gateway = createGateway({ prepare });
    const { result } = await renderConnected(gateway, createWallet({ signTransaction }));

    await act(() => result.current.submit(draft));

    expect(result.current.error?.kind).toBe("wallet_rejected");
    expect(result.current.error?.recoverable).toBe(true);
    expect(result.current.prepared).toEqual(prepared);

    await act(() => result.current.submit(draft));

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeUndefined();
    expect(result.current.result?.applied).toBe(true);
  });

  it("reports a wallet on another network distinctly", async () => {
    const signTransaction = vi.fn().mockRejectedValue(new WalletError("network_mismatch", "another network"));
    const gateway = createGateway();
    const { result } = await renderConnected(gateway, createWallet({ signTransaction }));

    await act(() => result.current.submit(draft));

    expect(result.current.error?.kind).toBe("wallet_network_mismatch");
    expect(result.current.error?.recoverable).toBe(true);
    expect(result.current.result).toBeUndefined();
  });

  it("ignores a second submit while one is in flight", async () => {
    let resolvePrepare!: (value: PreparedFundingIntent) => void;
    const prepare = vi.fn().mockReturnValue(new Promise<PreparedFundingIntent>((resolve) => (resolvePrepare = resolve)));
    const gateway = createGateway({ prepare });
    const { result } = await renderConnected(gateway, createWallet());

    let first!: Promise<void>;
    act(() => {
      first = result.current.submit(draft);
      void result.current.submit(draft);
    });
    expect(prepare).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePrepare(prepared);
      await first;
    });
    expect(result.current.result?.applied).toBe(true);
  });

  it("reports an exact replay as a replay, not as a fresh submission", async () => {
    const submit = vi.fn().mockResolvedValue({ applied: false, intent: snapshot });
    const gateway = createGateway({ submit });
    const { result } = await renderConnected(gateway, createWallet());

    await act(() => result.current.submit(draft));

    expect(result.current.result).toEqual({ applied: false, intent: snapshot });
  });

  it("refuses to submit before a wallet is connected", async () => {
    const gateway = createGateway();
    const { result } = renderHook(() => useFundingIntent(gateway, createWallet(), null));

    await act(() => result.current.submit(draft));

    expect(result.current.error?.kind).toBe("not_connected");
    expect(gateway.prepare).not.toHaveBeenCalled();
  });

  it("fails explicitly, without pretending, when no gateway is configured", async () => {
    const { result } = await renderConnected(null, createWallet());

    await act(() => result.current.submit(draft));

    expect(result.current.error?.kind).toBe("unavailable");
    expect(result.current.result).toBeUndefined();
  });

  it("requires a fresh prepare after a validation failure, since the prepared intent is gone", async () => {
    const prepare = vi
      .fn()
      .mockRejectedValueOnce(new HttpClientError("http", 400, undefined, "invalid_request"))
      .mockResolvedValueOnce(prepared);
    const gateway = createGateway({ prepare });
    const { result } = await renderConnected(gateway, createWallet());

    await act(() => result.current.submit(draft));

    expect(result.current.error?.kind).toBe("validation");
    expect(result.current.error?.recoverable).toBe(false);
    expect(result.current.prepared).toBeUndefined();

    await act(() => result.current.submit(draft));

    expect(prepare).toHaveBeenCalledTimes(2);
    expect(result.current.result?.applied).toBe(true);
  });

  it("reads the intent back through the gateway", async () => {
    const get = vi.fn().mockResolvedValue(snapshot);
    const gateway = createGateway({ get });
    const { result } = await renderConnected(gateway, createWallet());
    await act(() => result.current.submit(draft));

    await act(() => result.current.refreshStatus());

    expect(result.current.status?.transactionHash).toBe("TRANSACTION-HASH");
    expect(get).toHaveBeenCalledWith(INTENT_ID);
  });
});

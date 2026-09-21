import { describe, expect, it, vi } from "vitest";
import { WalletError } from "@/application/ports/wallet-port";
import { FreighterWallet } from "./freighter-wallet";
import type { FreighterApi } from "./freighter-wallet";

/**
 * Deterministic Freighter double — the "Freighter double" the Feature's testing
 * strategy calls for. No extension, no browser, no network.
 *
 * Error strings are the ones the installed `@stellar/freighter-api@6.0.1` and
 * its official docs document; the package resolves `{ error }` instead of
 * throwing, so these are the only signals available to classify a failure.
 */
// Synthetic and deliberately not a real network passphrase: the adapter only
// compares it for identity, and the web is never allowed to own the real value.
const WALLET_PASSPHRASE = "synthetic-wallet-passphrase";
const PUBLIC_KEY = "GDVEU3DDJGBXQKZTPJ7Q2PLZRZXQ4OBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const XDR = "AAAAAgAAAAA...unsigned";
const SIGNED_XDR = "AAAAAgAAAAA...signed";

const DOCUMENTED_ERRORS = {
  rejected: "The user rejected this request.",
  internal: "The wallet encountered an internal error. Please try again or contact the wallet if the problem persists.",
  nodeEnvironment: "Node environment is not supported"
} as const;

function createApi(overrides: Partial<FreighterApi> = {}): FreighterApi {
  return {
    isConnected: vi.fn(async () => ({ isConnected: true })),
    requestAccess: vi.fn(async () => ({ address: PUBLIC_KEY })),
    getNetwork: vi.fn(async () => ({
      network: "TESTNET",
      networkPassphrase: WALLET_PASSPHRASE
    })),
    signTransaction: vi.fn(async () => ({
      signedTxXdr: SIGNED_XDR,
      signerAddress: PUBLIC_KEY
    })),
    ...overrides
  };
}

async function failureFrom(action: () => Promise<unknown>): Promise<WalletError> {
  try {
    await action();
  } catch (error) {
    if (error instanceof WalletError) return error;
    throw error;
  }
  throw new Error("expected the call to fail, but it resolved");
}

describe("FreighterWallet.isAvailable", () => {
  it("reports true when Freighter is installed and enabled", async () => {
    const wallet = new FreighterWallet(createApi());

    await expect(wallet.isAvailable()).resolves.toBe(true);
  });

  it("reports false when Freighter is not installed", async () => {
    const wallet = new FreighterWallet(
      createApi({ isConnected: vi.fn(async () => ({ isConnected: false })) })
    );

    await expect(wallet.isAvailable()).resolves.toBe(false);
  });

  it("reports false, instead of throwing, outside a wallet-enabled host", async () => {
    const wallet = new FreighterWallet(
      createApi({
        isConnected: vi.fn(async () => ({
          isConnected: false,
          error: { code: -1, message: DOCUMENTED_ERRORS.nodeEnvironment }
        }))
      })
    );

    await expect(wallet.isAvailable()).resolves.toBe(false);
  });

  it("reports false when the probe itself fails", async () => {
    // An availability probe that raises is not an availability probe. The
    // extension bridge can reject outright, and the caller must still get an
    // answer it can act on.
    const wallet = new FreighterWallet(
      createApi({
        isConnected: vi.fn(async () => {
          throw new Error("extension bridge unavailable");
        })
      })
    );

    await expect(wallet.isAvailable()).resolves.toBe(false);
  });
});

describe("FreighterWallet.connect", () => {
  it("returns the public address and nothing else", async () => {
    const wallet = new FreighterWallet(createApi());

    await expect(wallet.connect()).resolves.toEqual({ publicKey: PUBLIC_KEY });
  });

  it("classifies a declined access request as a recoverable rejection", async () => {
    const wallet = new FreighterWallet(
      createApi({
        requestAccess: vi.fn(async () => ({
          address: "",
          error: { code: -1, message: DOCUMENTED_ERRORS.rejected }
        }))
      })
    );

    const error = await failureFrom(() => wallet.connect());

    expect(error.kind).toBe("rejected");
    expect(error.recoverable).toBe(true);
  });

  it("classifies a missing host as unavailable", async () => {
    const wallet = new FreighterWallet(
      createApi({
        requestAccess: vi.fn(async () => ({
          address: "",
          error: { code: -1, message: DOCUMENTED_ERRORS.nodeEnvironment }
        }))
      })
    );

    const error = await failureFrom(() => wallet.connect());

    expect(error.kind).toBe("unavailable");
    expect(error.recoverable).toBe(true);
  });

  it("refuses before asking for access when no wallet is installed", async () => {
    // `requestAccess` has no timeout of its own, so reaching it without an
    // extension would leave the caller waiting forever.
    const requestAccess = vi.fn(async () => ({ address: PUBLIC_KEY }));
    const wallet = new FreighterWallet(
      createApi({
        isConnected: vi.fn(async () => ({ isConnected: false })),
        requestAccess
      })
    );

    const error = await failureFrom(() => wallet.connect());

    expect(error.kind).toBe("unavailable");
    expect(requestAccess).not.toHaveBeenCalled();
  });

  it("treats an access grant with no address as an unrecoverable failure", async () => {
    // Not a rejection and not a missing wallet: the wallet answered, and the
    // answer was wrong. Nothing the person can do would change the outcome, so
    // the error must not invite a retry.
    const wallet = new FreighterWallet(
      createApi({ requestAccess: vi.fn(async () => ({ address: "" })) })
    );

    const error = await failureFrom(() => wallet.connect());

    expect(error.kind).toBe("unknown");
    expect(error.recoverable).toBe(false);
  });
});

describe("FreighterWallet.signTransaction", () => {
  it("returns the signed XDR for a Testnet transaction", async () => {
    const wallet = new FreighterWallet(createApi());

    await expect(wallet.signTransaction(XDR, WALLET_PASSPHRASE)).resolves.toBe(SIGNED_XDR);
  });

  it("sends the explicit passphrase and no key material to the wallet", async () => {
    const signTransaction = vi.fn(async () => ({
      signedTxXdr: SIGNED_XDR,
      signerAddress: PUBLIC_KEY
    }));
    const wallet = new FreighterWallet(createApi({ signTransaction }));

    await wallet.signTransaction(XDR, WALLET_PASSPHRASE);

    expect(signTransaction).toHaveBeenCalledExactlyOnceWith(XDR, {
      networkPassphrase: WALLET_PASSPHRASE
    });
  });

  it("classifies a declined signature as a recoverable rejection", async () => {
    const wallet = new FreighterWallet(
      createApi({
        signTransaction: vi.fn(async () => ({
          signedTxXdr: "",
          signerAddress: "",
          error: { code: -1, message: DOCUMENTED_ERRORS.rejected }
        }))
      })
    );

    const error = await failureFrom(() => wallet.signTransaction(XDR, WALLET_PASSPHRASE));

    expect(error.kind).toBe("rejected");
    expect(error.recoverable).toBe(true);
  });

  it("refuses a wallet pointed at another network before asking for a signature", async () => {
    const signTransaction = vi.fn(async () => ({
      signedTxXdr: SIGNED_XDR,
      signerAddress: PUBLIC_KEY
    }));
    const wallet = new FreighterWallet(
      createApi({
        getNetwork: vi.fn(async () => ({
          network: "PUBLIC",
          // A second synthetic value, distinct from WALLET_PASSPHRASE: the
          // adapter must refuse before asking for a signature.
          networkPassphrase: "synthetic-other-network-passphrase"
        })),
        signTransaction
      })
    );

    const error = await failureFrom(() => wallet.signTransaction(XDR, WALLET_PASSPHRASE));

    expect(error.kind).toBe("network_mismatch");
    expect(error.recoverable).toBe(true);
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("rejects an empty passphrase instead of letting the wallet default the network", async () => {
    const signTransaction = vi.fn(async () => ({
      signedTxXdr: SIGNED_XDR,
      signerAddress: PUBLIC_KEY
    }));
    const wallet = new FreighterWallet(createApi({ signTransaction }));

    await expect(wallet.signTransaction(XDR, "")).rejects.toBeInstanceOf(WalletError);
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("stays usable after a rejection, so a retry can succeed", async () => {
    const signTransaction = vi
      .fn()
      .mockResolvedValueOnce({
        signedTxXdr: "",
        signerAddress: "",
        error: { code: -1, message: DOCUMENTED_ERRORS.rejected }
      })
      .mockResolvedValueOnce({ signedTxXdr: SIGNED_XDR, signerAddress: PUBLIC_KEY });
    const wallet = new FreighterWallet(createApi({ signTransaction }));

    await expect(wallet.signTransaction(XDR, WALLET_PASSPHRASE)).rejects.toBeInstanceOf(WalletError);
    await expect(wallet.signTransaction(XDR, WALLET_PASSPHRASE)).resolves.toBe(SIGNED_XDR);
  });
});

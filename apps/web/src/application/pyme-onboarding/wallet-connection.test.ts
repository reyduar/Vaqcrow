import { describe, expect, it } from "vitest";
import type { WalletPort } from "@/application/ports/wallet-port";
import { FakeWallet, FakeWalletConnection } from "@/test/fake-wallet";
import { connectAndStoreWallet, walletConnectFailureCopy, type WalletConnectFailure } from "./wallet-connection";

const PUBLIC_KEY = "GBXK1234567890ABCD7Q2M";

function connectedWallet(key = PUBLIC_KEY): FakeWallet {
  const wallet = new FakeWallet();
  wallet.seedAccount(key);
  return wallet;
}

describe("connectAndStoreWallet", () => {
  it("connects, signs the challenge and stores the key", async () => {
    const wallet = connectedWallet();
    const connection = new FakeWalletConnection();

    const result = await connectAndStoreWallet(wallet, connection);

    expect(result).toEqual({ ok: true, connection: { publicKey: PUBLIC_KEY, frozen: false } });
    expect(connection.challengeCalls).toBe(1);
    expect(wallet.signedMessages).toHaveLength(1);
    expect(connection.submitted).toEqual([
      {
        challengeId: expect.any(String),
        publicKey: PUBLIC_KEY,
        signature: expect.stringContaining("fake-signature")
      }
    ]);
    // The signed message is exactly the API challenge, never a locally built one.
    const challenge = await connection.requestChallenge();
    expect(challenge.ok && wallet.signedMessages[0] === challenge.challenge.message).toBe(true);
  });

  it("maps a declined connect and never requests a challenge", async () => {
    const wallet = new FakeWallet();
    wallet.failNextConnect("rejected");
    const connection = new FakeWalletConnection();

    expect(await connectAndStoreWallet(wallet, connection)).toEqual({
      ok: false,
      stage: "wallet",
      code: "rejected"
    });
    expect(connection.challengeCalls).toBe(0);
    expect(connection.submitted).toHaveLength(0);
  });

  it("maps a wrong-network connect without touching the API", async () => {
    const wallet = new FakeWallet();
    wallet.failNextConnect("network_mismatch");
    const connection = new FakeWalletConnection();

    expect(await connectAndStoreWallet(wallet, connection)).toEqual({
      ok: false,
      stage: "wallet",
      code: "network_mismatch"
    });
    expect(connection.challengeCalls).toBe(0);
  });

  it("stops with the challenge's sanitized code and never signs", async () => {
    const wallet = connectedWallet();
    const connection = new FakeWalletConnection();
    connection.failNextChallenge("invalid_request");

    expect(await connectAndStoreWallet(wallet, connection)).toEqual({
      ok: false,
      stage: "challenge",
      code: "invalid_request"
    });
    expect(wallet.signedMessages).toHaveLength(0);
    expect(connection.submitted).toHaveLength(0);
  });

  it("maps a declined message signature and never submits", async () => {
    const wallet = connectedWallet();
    wallet.failNextSignMessage("rejected");
    const connection = new FakeWalletConnection();

    expect(await connectAndStoreWallet(wallet, connection)).toEqual({
      ok: false,
      stage: "signature",
      code: "rejected"
    });
    expect(connection.submitted).toHaveLength(0);
  });

  it("reports a store failure as the store stage so its copy differs from the wallet's", async () => {
    const wallet = connectedWallet();
    const connection = new FakeWalletConnection();
    connection.failNextSubmit("unavailable");

    const outcome = await connectAndStoreWallet(wallet, connection);

    expect(outcome).toEqual({ ok: false, stage: "store", code: "unavailable" });
    expect(walletConnectFailureCopy(outcome as WalletConnectFailure)).toBe(
      "No pudimos guardar tu wallet. Revisá tu conexión y probá de nuevo."
    );
  });

  it("passes the frozen code through the store stage", async () => {
    const wallet = connectedWallet();
    const connection = new FakeWalletConnection();
    connection.failNextSubmit("wallet_frozen");

    expect(await connectAndStoreWallet(wallet, connection)).toEqual({
      ok: false,
      stage: "store",
      code: "wallet_frozen"
    });
  });

  it("treats an unexpected wallet error as unknown", async () => {
    const wallet: WalletPort = {
      isAvailable: async () => true,
      connect: async () => {
        throw new Error("boom");
      },
      signTransaction: async (xdr) => xdr,
      signMessage: async () => "unused"
    };
    const connection = new FakeWalletConnection();

    expect(await connectAndStoreWallet(wallet, connection)).toEqual({ ok: false, stage: "wallet", code: "unknown" });
    expect(connection.challengeCalls).toBe(0);
  });
});

describe("walletConnectFailureCopy", () => {
  it("hints how to create a wallet when none is installed", () => {
    expect(walletConnectFailureCopy({ ok: false, stage: "wallet", code: "unavailable" })).toContain("creá una wallet");
  });

  it("asks for Stellar Testnet on a network mismatch", () => {
    expect(walletConnectFailureCopy({ ok: false, stage: "wallet", code: "network_mismatch" })).toBe(
      "Freighter está en otra red. Cambiá a Stellar Testnet para continuar."
    );
  });

  it("reports a persistence failure with its own copy", () => {
    expect(walletConnectFailureCopy({ ok: false, stage: "store", code: "unavailable" })).toBe(
      "No pudimos guardar tu wallet. Revisá tu conexión y probá de nuevo."
    );
  });
});

import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { StellarWalletSignature } from "./stellar-wallet-signature.js";

/**
 * The installed `@stellar/freighter-api@6.0.1` exposes `signMessage`, which
 * signs per SEP-53 (`"Stellar Signed Message:\n"` + message, SHA-256, ed25519).
 * The server verifies with `Keypair.verifyMessage`. These tests round-trip a
 * real keypair locally; no wallet, network or Testnet is involved.
 */
const MESSAGE = "Vaqcrow wallet connection challenge\n\nNonce: abc-123";

function base64Signature(keypair: Keypair, message: string): string {
  return Buffer.from(keypair.signMessage(message)).toString("base64");
}

describe("StellarWalletSignature.verifyMessage", () => {
  it("accepts a real SEP-53 signature over the exact message", () => {
    const keypair = Keypair.random();
    const signature = base64Signature(keypair, MESSAGE);

    expect(
      new StellarWalletSignature().verifyMessage({ publicKey: keypair.publicKey(), message: MESSAGE, signature })
    ).toBe(true);
  });

  it("rejects a signature over a different message (nonce tampering)", () => {
    const keypair = Keypair.random();
    const signature = base64Signature(keypair, MESSAGE);

    expect(
      new StellarWalletSignature().verifyMessage({
        publicKey: keypair.publicKey(),
        message: "Vaqcrow wallet connection challenge\n\nNonce: OTHER",
        signature
      })
    ).toBe(false);
  });

  it("rejects a valid signature presented for another public key", () => {
    const signer = Keypair.random();
    const other = Keypair.random();
    const signature = base64Signature(signer, MESSAGE);

    expect(
      new StellarWalletSignature().verifyMessage({ publicKey: other.publicKey(), message: MESSAGE, signature })
    ).toBe(false);
  });

  it.each([
    ["a malformed public key", { publicKey: "not-a-key", message: MESSAGE, signature: "AAAA" }],
    ["an empty signature", { publicKey: Keypair.random().publicKey(), message: MESSAGE, signature: "" }],
    ["a non-base64 signature", { publicKey: Keypair.random().publicKey(), message: MESSAGE, signature: "!!!not-base64!!!" }],
    ["a truncated signature", { publicKey: Keypair.random().publicKey(), message: MESSAGE, signature: "AAAA" }]
  ])("returns false for %s instead of throwing", (_label, input) => {
    expect(new StellarWalletSignature().verifyMessage(input)).toBe(false);
  });
});

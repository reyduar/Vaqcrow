import { Account, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { Secret } from "../../application/config/secret.js";
import { PlatformSigner } from "./platform-signer.js";

/**
 * `Keypair.random()` and reading `.secret()` straight back off it are both
 * ephemeral-signer uses the non-custody scanner (`tests/stellar-non-custody.test.ts`)
 * already admits in a test file — the seed never touches a real account and is
 * never persisted.
 */
function randomSecret(): { readonly keypair: Keypair; readonly secret: Secret } {
  const keypair = Keypair.random();
  return { keypair, secret: new Secret(keypair.secret()) };
}

function unsignedTransaction(sourceAccountId: string) {
  return new TransactionBuilder(new Account(sourceAccountId, "0"), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(Operation.bumpSequence({ bumpTo: "1" }))
    .setTimeout(30)
    .build();
}

describe("PlatformSigner", () => {
  it("exposes the public key that corresponds to the wrapped secret", () => {
    const { keypair, secret } = randomSecret();

    const signer = new PlatformSigner(secret);

    expect(signer.publicKey).toBe(keypair.publicKey());
  });

  it("signs a transaction with the platform's own key and returns it", () => {
    const { keypair, secret } = randomSecret();
    const signer = new PlatformSigner(secret);
    const transaction = unsignedTransaction(keypair.publicKey());

    const signed = signer.sign(transaction);

    expect(signed).toBe(transaction);
    expect(transaction.signatures).toHaveLength(1);
    const [firstSignature] = transaction.signatures;
    expect(firstSignature).toBeDefined();
    expect(keypair.verify(transaction.hash(), firstSignature?.signature ?? Buffer.alloc(0))).toBe(true);
  });

  it("never lets the secret escape through JSON.stringify", () => {
    const { keypair, secret } = randomSecret();
    const signer = new PlatformSigner(secret);

    const serialized = JSON.stringify({ signer });

    expect(serialized).not.toContain(keypair.secret());
  });

  it("never lets the secret escape through String() coercion", () => {
    const { keypair, secret } = randomSecret();
    const signer = new PlatformSigner(secret);

    expect(String(signer)).not.toContain(keypair.secret());
    expect(`${signer}`).not.toContain(keypair.secret());
  });

  it("does not expose the secret as an enumerable own property", () => {
    const { keypair, secret } = randomSecret();
    const signer = new PlatformSigner(secret);

    expect(Object.keys(signer)).not.toContain("secretKey");
    expect(JSON.stringify(Object.values(signer))).not.toContain(keypair.secret());
  });
});

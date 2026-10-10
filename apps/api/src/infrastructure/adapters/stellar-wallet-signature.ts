import { Keypair } from "@stellar/stellar-sdk";
import type { WalletSignaturePort } from "../../application/ports/wallet-signature-port.js";

/**
 * SEP-53 message verification for the wallet challenge (Feature #406, Task #407
 * / T1b).
 *
 * Choice and rationale: the installed `@stellar/freighter-api@6.0.1` exports
 * `signMessage`, which signs `SHA-256("Stellar Signed Message:\n" + message)`
 * with the account's ed25519 key (SEP-53). The matching server-side inverse is
 * `@stellar/stellar-sdk`'s `Keypair.verifyMessage`, so the challenge stays a
 * plain message and never has to masquerade as a transaction. Freighter's
 * `signMessage` returns the signature base64-encoded, so it is decoded here
 * before verification.
 *
 * The SDK lives in `infrastructure/`, never in `application/`: the port and use
 * cases stay vendor-free (the `api-application-stays-provider-free` rule).
 * Every malformed input collapses to `false` rather than throwing, so a bad key
 * or signature is an authentication failure, not a 500.
 */
export class StellarWalletSignature implements WalletSignaturePort {
  verifyMessage(input: {
    readonly publicKey: string;
    readonly message: string;
    readonly signature: string;
  }): boolean {
    try {
      const signature = Buffer.from(input.signature, "base64");
      if (signature.length !== 64) {
        return false;
      }
      return Keypair.fromPublicKey(input.publicKey).verifyMessage(input.message, signature);
    } catch {
      return false;
    }
  }
}

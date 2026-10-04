/**
 * Message-signature verification for the wallet challenge (Feature #406, Task
 * #407 / T1b).
 *
 * The concrete verifier uses `@stellar/stellar-sdk`'s SEP-53
 * `Keypair.verifyMessage`, which belongs in `infrastructure/`. The port stays
 * vendor-free so the use cases can orchestrate verification without importing
 * the SDK (the `api-application-stays-provider-free` boundary rule).
 */
export interface WalletSignaturePort {
  /**
   * Verifies a base64-encoded SEP-53 signature over `message` for `publicKey`.
   * Returns `false` for any malformed input (bad key, wrong signature length,
   * tampered message) and never throws.
   */
  verifyMessage(input: {
    readonly publicKey: string;
    readonly message: string;
    readonly signature: string;
  }): boolean;
}

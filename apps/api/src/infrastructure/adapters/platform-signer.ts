import { Keypair } from "@stellar/stellar-sdk";
import type { FeeBumpTransaction, Transaction } from "@stellar/stellar-sdk";
import type { Secret } from "../../application/config/secret.js";

/**
 * The platform's own operational signing key (D8 in
 * `odd/tasks/campaign-vault-web-journey.md`).
 *
 * Feature #23's guarantee is that Vaqcrow never handles a *user's* key —
 * Freighter signs in the browser, and every other adapter only ever sees a
 * public address or a transaction someone else signed. That guarantee is
 * untouched. What #247 adds is that the *platform* now needs one key of its
 * own: it owns the campaign factory (`contracts/campaign-factory/src/lib.rs`,
 * `owner.require_auth()`) and has to sign `CreateAccount` when it funds the
 * SME's own account (D2) and `factory.deploy()` when it opens the vault.
 *
 * This is deliberately the *only* file allowed to turn that key's `Secret`
 * into a `Keypair` — `tests/stellar-non-custody.test.ts` enforces it by
 * scanning the AST of every other file under `apps/api/src` and
 * `apps/web/src`. Keeping the concession to one audited file is what makes
 * it reviewable: widening it is a deliberate, visible change to that test's
 * allowlist, never an accident of a refactor that happens to import
 * `Keypair` somewhere else.
 *
 * `reveal()` is called exactly once, here, in the constructor — the same
 * point-of-use discipline `Secret` itself documents. Past this constructor,
 * the raw seed is gone: only the `Keypair` it derived remains, held in a
 * private field `toString`/`toJSON`/`console.log` cannot reach.
 */
export class PlatformSigner {
  /** Safe to log, return or serialise — it is public data by definition. */
  readonly publicKey: string;

  readonly #signingKey: Keypair;

  constructor(platformKey: Secret) {
    this.#signingKey = Keypair.fromSecret(platformKey.reveal());
    this.publicKey = this.#signingKey.publicKey();
  }

  /**
   * Signs in place and returns the same transaction, mirroring the SDK's own
   * `Transaction.sign` shape — a caller building a transaction with
   * `TransactionBuilder` gets it back ready to submit, without having to
   * remember which reference is now signed.
   */
  sign<T extends Transaction | FeeBumpTransaction>(transaction: T): T {
    transaction.sign(this.#signingKey);
    return transaction;
  }

  /**
   * Neither of these is ever called with the key material in mind — they
   * exist only so an accidental `console.log(signer)`, template literal or
   * `JSON.stringify` prints a harmless marker instead of walking into
   * `#signingKey` some other way. `#signingKey` is a private class field, so
   * `util.inspect`/`JSON.stringify`'s own default traversal never reaches it
   * regardless; these overrides are the explicit, reviewable version of that
   * same guarantee, matching `Secret`'s own `toString`/`toJSON`.
   */
  toString(): string {
    return "[PlatformSigner]";
  }

  toJSON(): string {
    return "[PlatformSigner]";
  }
}

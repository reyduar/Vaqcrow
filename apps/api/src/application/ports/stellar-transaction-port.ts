import type { StellarFailureReason } from "@vaqcrow/contracts";

/**
 * Submitting a signed envelope to the network, and reading back what became of
 * it.
 *
 * **Why this is not `LedgerPort`.** `LedgerPort` reads a public account, and its
 * own doc is explicit that nothing in its shape "is — or can become — key
 * material"; it models exactly one operation. Submission is a *write*, and it is
 * the capability #25 adds. It is also a different conversation: a submission is
 * made once and then read back repeatedly until the network has decided, which is
 * why the two operations live together here. Splitting them would let a caller
 * look up a hash it never submitted, and would put the read-back of a write
 * somewhere the write is not.
 *
 * **What this port deliberately does not model.** It has no notion of retrying,
 * of how many attempts have been made, or of when the next one is due. Those are
 * policy, and policy belongs to the use case that owns the schedule — this port
 * answers "what does the network say right now" and nothing more. It also has no
 * notion of expiry: the envelope's `maxTime` is already persisted by the verified
 * submission, so the bound is decided where the deadline is known rather than
 * inferred here from a provider's error code.
 *
 * **Why `not_found` is not an error.** Horizon serves its transaction lookup from
 * the history it has ingested, so a transaction that has not been included in a
 * ledger yet simply is not there. That is the expected state of every submission
 * for its first few seconds, so it is modelled as `pending` — an outcome, not a
 * failure to retry.
 */

export type StellarTransactionErrorCode = "invalid_input" | "unavailable";

export interface StellarTransactionError {
  readonly code: StellarTransactionErrorCode;
}

export type StellarTransactionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: StellarTransactionError };

/**
 * What the network said when the envelope was handed to it.
 *
 * `accepted` is not `confirmed`. Horizon relays stellar-core's answer without
 * waiting for a ledger, so `accepted` means the transaction is in flight and may
 * still fail to be included — the docs say so in as many words. Treating it as
 * success would be exactly the claim `DEMO.md` forbids: the initial response is
 * never presented as settlement.
 */
export type StellarSubmissionOutcome =
  | { readonly status: "accepted" }
  | { readonly status: "rejected"; readonly reason: StellarFailureReason };

/**
 * What the network has decided, as far as Horizon can currently tell.
 *
 * `confirmed` carries Horizon's own evidence rather than a local clock reading:
 * the ledger that included the transaction and that ledger's close time. Those
 * are the two facts that make the state auditable afterwards.
 */
export type StellarTransactionOutcome =
  | { readonly status: "pending" }
  | {
      readonly status: "confirmed";
      /** The ledger that included the transaction. A uint64: string, never a number. */
      readonly ledgerSequence: string;
      /** Horizon's ledger close time for that ledger, not a local timestamp. */
      readonly confirmedAt: string;
    }
  | { readonly status: "failed"; readonly reason: StellarFailureReason };

export interface StellarTransactionPort {
  /**
   * Hands a signed envelope to the network without waiting for a ledger.
   *
   * `invalid_input` means the envelope could not be decoded into a transaction
   * this port is willing to submit — it is a malformed record rather than a
   * transient condition, so a caller should not retry it. `unavailable` is the
   * transient one.
   */
  submit(signedXdr: string): Promise<StellarTransactionResult<StellarSubmissionOutcome>>;

  /**
   * Reads what became of a previously submitted transaction.
   *
   * A transaction Horizon has not ingested yet is `pending` rather than an error,
   * because that is what every submission looks like before its ledger closes.
   */
  findTransaction(hash: string): Promise<StellarTransactionResult<StellarTransactionOutcome>>;
}

import { z } from "zod";

/**
 * Why a Stellar transaction failed, as the demo reports it.
 *
 * This is a **closed** vocabulary on purpose, and the closure is the whole
 * point. Horizon reports failures as its own result codes — `tx_bad_seq`,
 * `tx_too_late`, `tx_insufficient_fee` and about thirty more — and the tempting
 * shortcut is to pass one straight through. That would make a provider's
 * internal enum into Vaqcrow's wire contract: a Horizon or protocol upgrade
 * could add, rename or retire a code, and the change would surface as a
 * contract value nobody chose, in a field a person reads.
 *
 * So the mapping happens once, at the adapter that talks to Horizon, and only
 * these six values ever cross a boundary. Anything Horizon reports that has no
 * name here is `unsuccessful`, which is honest about what Vaqcrow knows rather
 * than pretending to a precision it does not have.
 *
 * `expired` deserves a note: it is reached two ways, and they agree. Horizon can
 * report `tx_too_late` when an envelope's `maxTime` passed before inclusion, and
 * Vaqcrow reaches the same conclusion locally from the `expiresAt` a verified
 * submission already persisted. The local bound is the backstop, because it does
 * not depend on Horizon answering at all.
 */
export const stellarFailureReasonSchema = z.enum([
  /** The source account cannot cover the amount plus the fee. */
  "insufficient_balance",
  /** The envelope's sequence is not the source account's current one. */
  "bad_sequence",
  /** The declared fee is below what the network will accept. */
  "insufficient_fee",
  /** The envelope's `maxTime` passed before the transaction was included. */
  "expired",
  /** The envelope's `minTime` is ahead of the ledger close time. */
  "too_early",
  /** The network refused it and Vaqcrow has no more specific name for why. */
  "unsuccessful"
]);

export type StellarFailureReason = z.infer<typeof stellarFailureReasonSchema>;

export function parseStellarFailureReason(input: unknown): StellarFailureReason {
  return stellarFailureReasonSchema.parse(input);
}

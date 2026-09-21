import type { StellarFailureReason } from "@vaqcrow/contracts";

/**
 * Why a transaction failed, in the words the demo shows.
 *
 * The API reports a closed vocabulary rather than Horizon's result code (`D10`),
 * and this is the other half of that decision: the code is a contract value, not
 * a sentence, so the sentence is composed where a person reads it. Because the
 * vocabulary is closed, `Record<StellarFailureReason, string>` makes the mapping
 * exhaustive by type — a new reason cannot reach the screen untranslated, and
 * there is no fallback branch to forget to write.
 */
const FAILURE_REASON_COPY: Readonly<Record<StellarFailureReason, string>> = {
  insufficient_balance: "La cuenta de origen no alcanza a cubrir el monto más la comisión.",
  bad_sequence: "El número de secuencia de la cuenta no es el vigente.",
  insufficient_fee: "La comisión declarada quedó por debajo del mínimo de la red.",
  expired: "La transacción expiró antes de ser incluida en un ledger.",
  too_early: "La transacción todavía no puede ejecutarse en la red.",
  unsuccessful: "La red rechazó la transacción."
};

export function failureReasonCopy(reason: StellarFailureReason): string {
  return FAILURE_REASON_COPY[reason];
}

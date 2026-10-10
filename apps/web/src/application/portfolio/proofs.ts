import type { PortfolioPosition } from "@/application/ports/portfolio-port";
import { formatDate, formatXlmAmount } from "./format";

/**
 * The Testnet proof of an investor's position (#438/WU5, owner decision D3):
 * the vault and each observed contribute transaction, so the investor can
 * check on the explorer what the card claims. Pure and React-free; the API
 * builds every explorer URL (`null` without an explorer base) and this module
 * never derives one.
 *
 * A contribution made before hashes were persisted has no transaction: the
 * card shows «Sin dato», never a zero or an invented hash. Copy is
 * owner-pending (the template does not draw this block).
 */

export const PORTFOLIO_PROOF_COPY = {
  vault: "Bóveda",
  transactionsTitle: "Tus transacciones de aporte",
  transactionHash: "Hash del aporte",
  distributionHash: "Hash",
  missing: "Sin dato"
} as const;

export interface PositionTransactionRow {
  readonly transactionHash: string;
  /** This transaction's own amount, e.g. `250,0000000 XLM`. */
  readonly amount: string;
  /** The day the chain read confirmed it (UTC), e.g. `08/10/2026`. */
  readonly date: string;
  readonly explorerUrl: string | null;
}

/** The position's observed contributions in the API's order (oldest first). */
export function toPositionTransactionRows(position: PortfolioPosition): readonly PositionTransactionRow[] {
  return position.transactions.map((transaction) => ({
    transactionHash: transaction.transactionHash,
    amount: formatXlmAmount(transaction.amountXlm),
    date: formatDate(transaction.observedAt),
    explorerUrl: transaction.explorerUrl
  }));
}

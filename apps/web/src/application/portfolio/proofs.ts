import type { PortfolioPosition } from "@/application/ports/portfolio-port";
import { xlmToStroops } from "@/application/funding/xlm-amount";
import { formatDate, formatXlmAmount } from "./format";

/**
 * The Testnet proof of an investor's position (#438/WU5, owner decision D3):
 * the vault and each observed contribute transaction, so the investor can
 * check on the explorer what the card claims. Pure and React-free; the API
 * builds every explorer URL (`null` without an explorer base) and this module
 * never derives one.
 *
 * A contribution made before hashes were persisted has no transaction: with
 * none at all the card shows «Hash del aporte: Sin dato»; when only part of the
 * position's total is covered by hashed transactions, the card lists them and
 * adds one line naming the unhashed remainder (`unhashedContributionLine`),
 * never a zero or an invented hash. Copy is owner-pending (the template does
 * not draw this block).
 */

export const PORTFOLIO_PROOF_COPY = {
  vault: "Bóveda",
  transactionsTitle: "Tus transacciones de aporte",
  transactionHash: "Hash del aporte",
  distributionHash: "Hash",
  missing: "Sin dato",
  unhashedPrior: "Aportes anteriores sin hash registrado",
  unhashedPriorUnknown: "Hay aportes anteriores sin hash registrado"
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

const STROOPS_PER_XLM = 10_000_000n;

/** Canonical XLM -> stroops as a `bigint`; `null` when it is not an exact 7-decimal amount. */
function toStroops(xlm: string): bigint | null {
  const result = xlmToStroops(xlm);
  return result.ok ? BigInt(result.stroops) : null;
}

/** Stroops -> the canonical 7-decimal XLM string, e.g. `2500000000n` -> `"250.0000000"`. */
function stroopsToXlm(stroops: bigint): string {
  const fraction = (stroops % STROOPS_PER_XLM).toString().padStart(7, "0");
  return `${stroops / STROOPS_PER_XLM}.${fraction}`;
}

/**
 * The line disclosing the part of a position's contribution that has no
 * recorded hash (contributions made before hashes were persisted), shown next
 * to the hashed transactions. `null` when the hashed transactions cover the
 * total, or when there are none (the card then shows «Hash del aporte: Sin
 * dato» on its own). The remainder is computed in integer stroops, so no float
 * rounding can invent or hide a gap; when an amount cannot be read exactly the
 * line states the gap without a number.
 */
export function unhashedContributionLine(position: PortfolioPosition): string | null {
  if (position.transactions.length === 0) return null;

  const total = toStroops(position.contributionXlm);
  const amounts = position.transactions.map((transaction) => toStroops(transaction.amountXlm));
  if (total === null || amounts.some((amount) => amount === null)) {
    return PORTFOLIO_PROOF_COPY.unhashedPriorUnknown;
  }

  const hashed = amounts.reduce<bigint>((sum, amount) => sum + (amount ?? 0n), 0n);
  const remainder = total - hashed;
  if (remainder <= 0n) return null;
  return `${PORTFOLIO_PROOF_COPY.unhashedPrior}: ${formatXlmAmount(stroopsToXlm(remainder))} · ${PORTFOLIO_PROOF_COPY.missing}`;
}

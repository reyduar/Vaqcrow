import type { PortfolioPositionStatus } from "@vaqcrow/contracts";

/**
 * The investor portfolio's withdraw/refund action vocabulary (Feature #426,
 * WU3). Pure, React-free **and presentation-free**: the description rows and
 * the status-list items that render the shared components live in the
 * presentation layer (`portfolio-position-action.tsx`), so this module never
 * reaches into `presentation/`.
 *
 * The action is chosen from the **portfolio position's own `status`** (an
 * API-derived fact, `PortfolioPositionStatus`), never re-derived from a
 * campaign snapshot: `funding` -> withdraw, `refunding` -> refund, `settled` ->
 * none. The portfolio's `refunding` status already folds in "funding expired
 * below goal" server-side (`get-investor-portfolio.ts:102-108`), so the refund
 * rule here is simply `status === "refunding"` — it never re-checks a deadline.
 *
 * Every string is reused verbatim from the shipped flows
 * (`campaign-withdraw.tsx`'s "Retirar mi aporte" / "Retirando…",
 * `campaign-workspace.tsx`'s "Reembolsar" / "Reembolsando…", and the custody
 * row), so the portfolio never invents copy the template did not design.
 */

/** The two vault operations a position can offer. Shared with the vault engine's `ContractOperation`. */
export type PositionOperation = "withdraw" | "refund";

/**
 * The action a position offers, or `null` when it has none. `settled` is the
 * only terminal status with nothing left for the investor to sign.
 */
export function positionActionFor(status: PortfolioPositionStatus): PositionOperation | null {
  if (status === "funding") return "withdraw";
  if (status === "refunding") return "refund";
  return null;
}

export interface PositionActionCopy {
  /** The action button label while idle. */
  readonly button: string;
  /** The action button label while the review is signing. */
  readonly pending: string;
  /** The review modal heading, parameterized with the position's name. */
  readonly reviewTitle: (name: string) => string;
}

/** The shipped withdraw/refund copy, keyed by the operation it names. */
export const POSITION_ACTION_COPY: Readonly<Record<PositionOperation, PositionActionCopy>> = {
  withdraw: {
    button: "Retirar mi aporte",
    pending: "Retirando…",
    reviewTitle: (name) => `Retirar tu aporte de ${name}`
  },
  refund: {
    button: "Reembolsar",
    pending: "Reembolsando…",
    reviewTitle: (name) => `Reembolsar tu aporte de ${name}`
  }
};

/**
 * How far the last attempt got. `sent` is the only state the caller can hold
 * before the ledger answers; `confirmed` is only produced from the engine's own
 * poll observing the transaction, never from a local claim. It names no
 * presentation type, so it stays in this layer.
 */
export type PositionActionOutcome = "signed" | "sent" | "confirmed" | "failed";

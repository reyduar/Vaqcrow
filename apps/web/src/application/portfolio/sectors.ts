import type { PortfolioPosition } from "@/application/ports/portfolio-port";

/**
 * "Aportes por sector" (Feature #426, WU2). Sums each investor's contribution
 * per sector with `BigInt` on the canonical string, then returns whole percents
 * sorted descending by amount — the template shows whole percents
 * (`Vaqcrow Portafolio.dc.html:287`). Never converts money to a `Number` for
 * the arithmetic; only the final percentage is a number. Pure.
 */
export interface SectorShare {
  readonly sector: string;
  /** Rounded whole percent (`0..100`). */
  readonly percent: number;
}

/** Canonical XLM has exactly 7 decimals, so dropping the point yields stroops exactly. */
function toStroops(xlm: string): bigint {
  return BigInt(xlm.replace(".", ""));
}

export function sectorBreakdown(positions: readonly PortfolioPosition[]): readonly SectorShare[] {
  const totals = new Map<string, bigint>();
  for (const position of positions) {
    totals.set(position.sector, (totals.get(position.sector) ?? 0n) + toStroops(position.contributionXlm));
  }

  let total = 0n;
  for (const amount of totals.values()) total += amount;
  if (total === 0n) return [];

  return [...totals.entries()]
    .map(([sector, amount]) => ({ sector, amount, percent: Number((amount * 100n + total / 2n) / total) }))
    .sort((left, right) => (left.amount === right.amount ? 0 : left.amount > right.amount ? -1 : 1))
    .map(({ sector, percent }) => ({ sector, percent }));
}

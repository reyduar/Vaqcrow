import type { PortfolioPositionStatus } from "@vaqcrow/contracts";
import type { PortfolioPosition } from "@/application/ports/portfolio-port";

/**
 * Position ordering (Feature #426, WU2). The read model carries no per-
 * contribution timestamp, so "recent" is defined as the API's own order and
 * "state" as a stable sort by lifecycle rank; ties keep the API order. A true
 * recency would need a `contributedAt` field (candidate for #430). Pure.
 */
export type PortfolioSortMode = "recent" | "state";

const STATUS_RANK: Readonly<Record<PortfolioPositionStatus, number>> = {
  funding: 0,
  settled: 1,
  refunding: 2
};

export function sortPortfolioPositions(
  positions: readonly PortfolioPosition[],
  mode: PortfolioSortMode
): readonly PortfolioPosition[] {
  if (mode === "recent") return [...positions];
  return positions
    .map((position, index) => ({ position, index }))
    .sort((left, right) => {
      const byRank = STATUS_RANK[left.position.status] - STATUS_RANK[right.position.status];
      return byRank !== 0 ? byRank : left.index - right.index;
    })
    .map(({ position }) => position);
}

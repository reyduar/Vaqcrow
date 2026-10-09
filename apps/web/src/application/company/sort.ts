import type { MyCampaignState } from "@vaqcrow/contracts";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";

/**
 * Campaign ordering for the «Bóveda y distribuciones» list (Feature #434, WU2).
 * The read model carries no per-campaign creation timestamp, so "recent" is the
 * API's own order (D3 returns the list in the API's order) and "state" is a
 * stable sort by lifecycle rank; ties keep the API order. Pure and React-free.
 */
export type MyCampaignSortMode = "recent" | "state";

const STATE_RANK: Readonly<Record<MyCampaignState, number>> = {
  funding: 0,
  settled: 1,
  refunding: 2
};

export function sortMyCampaigns(
  campaigns: readonly MyCampaign[],
  mode: MyCampaignSortMode
): readonly MyCampaign[] {
  if (mode === "recent") return [...campaigns];
  return campaigns
    .map((campaign, index) => ({ campaign, index }))
    .sort((left, right) => {
      const byRank = STATE_RANK[left.campaign.state] - STATE_RANK[right.campaign.state];
      return byRank !== 0 ? byRank : left.index - right.index;
    })
    .map(({ campaign }) => campaign);
}

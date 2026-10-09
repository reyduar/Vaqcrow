import { describe, expect, it } from "vitest";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import { sortMyCampaigns } from "./sort";

function campaign(campaignId: string, state: MyCampaign["state"]): MyCampaign {
  return {
    campaignId,
    name: `Campaña ${campaignId}`,
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
    state,
    goalArs: 15_000_000,
    raisedArs: 9_450_000,
    fundedPercentBps: 6_300,
    deadline: "2026-11-30T12:00:00.000Z",
    contributorsCount: 38,
    distributions: [],
    sales: []
  };
}

describe("sortMyCampaigns", () => {
  it("keeps the API order for the recent mode", () => {
    const input = [campaign("a", "settled"), campaign("b", "funding"), campaign("c", "refunding")];
    expect(sortMyCampaigns(input, "recent").map((item) => item.campaignId)).toEqual(["a", "b", "c"]);
  });

  it("sorts by lifecycle rank for the state mode and keeps ties stable", () => {
    const input = [campaign("a", "settled"), campaign("b", "funding"), campaign("c", "refunding"), campaign("d", "funding")];
    expect(sortMyCampaigns(input, "state").map((item) => item.campaignId)).toEqual(["b", "d", "a", "c"]);
  });

  it("does not mutate the input list", () => {
    const input = [campaign("a", "settled"), campaign("b", "funding")];
    sortMyCampaigns(input, "state");
    expect(input.map((item) => item.campaignId)).toEqual(["a", "b"]);
  });
});

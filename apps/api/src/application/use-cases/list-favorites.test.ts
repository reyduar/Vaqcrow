import { describe, expect, it } from "vitest";
import type { FavoriteRepositoryPort } from "../ports/favorite-repository-port.js";
import { listFavorites } from "./list-favorites.js";

/**
 * The favorites list use case (#414/WU2). The caller's id always comes from the
 * verified principal, and a repository failure is `unavailable` — never an
 * empty-but-successful list that would show "no favorites" when the lookup
 * actually broke.
 */
const USER_ID = "00000000-0000-4000-8000-000000000002";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";

function fakeRepository(
  value: Awaited<ReturnType<FavoriteRepositoryPort["listCampaignIds"]>>
): Pick<FavoriteRepositoryPort, "listCampaignIds"> {
  return { listCampaignIds: async () => value };
}

describe("listFavorites", () => {
  it("returns the caller's campaign ids", async () => {
    const result = await listFavorites({ favorites: fakeRepository({ ok: true, value: [CAMPAIGN_ID] }) }, USER_ID);

    expect(result).toEqual({ ok: true, value: { campaignIds: [CAMPAIGN_ID] } });
  });

  it("returns an empty list when the caller has no favorites", async () => {
    const result = await listFavorites({ favorites: fakeRepository({ ok: true, value: [] }) }, USER_ID);

    expect(result).toEqual({ ok: true, value: { campaignIds: [] } });
  });

  it("maps a repository failure to unavailable, never an empty list", async () => {
    const result = await listFavorites(
      { favorites: fakeRepository({ ok: false, error: { code: "unavailable" } }) },
      USER_ID
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

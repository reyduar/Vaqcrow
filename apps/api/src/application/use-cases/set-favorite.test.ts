import { describe, expect, it, vi } from "vitest";
import type { FavoriteRepositoryPort } from "../ports/favorite-repository-port.js";
import { setFavorite } from "./set-favorite.js";

/**
 * The add/remove favorites use case (#414/WU2). `active: true` adds, `false`
 * removes; the idempotent outcome (`applied: false`) and the unknown-campaign
 * `not_found` both travel through untouched, and the userId is the verified
 * principal the caller passed, never anything else.
 */
const USER_ID = "00000000-0000-4000-8000-000000000002";
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";

function fakeRepository(overrides: Partial<FavoriteRepositoryPort> = {}): {
  readonly favorites: FavoriteRepositoryPort;
  readonly add: ReturnType<typeof vi.fn>;
  readonly remove: ReturnType<typeof vi.fn>;
} {
  const add = vi.fn(async () => ({ ok: true as const, value: { applied: true } }));
  const remove = vi.fn(async () => ({ ok: true as const, value: { applied: true } }));
  return {
    favorites: {
      listCampaignIds: async () => ({ ok: true, value: [] }),
      add,
      remove,
      ...overrides
    },
    add,
    remove
  };
}

describe("setFavorite", () => {
  it("adds when active is true, scoped to the given principal", async () => {
    const fake = fakeRepository();

    const result = await setFavorite(
      { favorites: fake.favorites },
      { userId: USER_ID, campaignId: CAMPAIGN_ID, active: true }
    );

    expect(result).toEqual({ ok: true, value: { campaignId: CAMPAIGN_ID, applied: true } });
    expect(fake.add).toHaveBeenCalledExactlyOnceWith(USER_ID, CAMPAIGN_ID);
    expect(fake.remove).not.toHaveBeenCalled();
  });

  it("removes when active is false, scoped to the given principal", async () => {
    const fake = fakeRepository();

    const result = await setFavorite(
      { favorites: fake.favorites },
      { userId: USER_ID, campaignId: CAMPAIGN_ID, active: false }
    );

    expect(result).toEqual({ ok: true, value: { campaignId: CAMPAIGN_ID, applied: true } });
    expect(fake.remove).toHaveBeenCalledExactlyOnceWith(USER_ID, CAMPAIGN_ID);
    expect(fake.add).not.toHaveBeenCalled();
  });

  it("passes through the idempotent applied:false outcome of a replay", async () => {
    const fake = fakeRepository({
      add: async () => ({ ok: true, value: { applied: false } })
    });

    const result = await setFavorite(
      { favorites: fake.favorites },
      { userId: USER_ID, campaignId: CAMPAIGN_ID, active: true }
    );

    expect(result).toEqual({ ok: true, value: { campaignId: CAMPAIGN_ID, applied: false } });
  });

  it("maps an unknown campaign to not_found", async () => {
    const fake = fakeRepository({
      add: async () => ({ ok: false, error: { code: "not_found" } })
    });

    const result = await setFavorite(
      { favorites: fake.favorites },
      { userId: USER_ID, campaignId: CAMPAIGN_ID, active: true }
    );

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("maps a provider failure to unavailable", async () => {
    const fake = fakeRepository({
      remove: async () => ({ ok: false, error: { code: "unavailable" } })
    });

    const result = await setFavorite(
      { favorites: fake.favorites },
      { userId: USER_ID, campaignId: CAMPAIGN_ID, active: false }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

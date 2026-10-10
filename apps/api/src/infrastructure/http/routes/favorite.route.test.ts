import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type {
  FavoriteRepositoryPort,
  FavoriteRepositoryResult
} from "../../../application/ports/favorite-repository-port.js";
import { buildApp } from "../build-app.js";
import { buildAppAs, principalFor } from "../test-support/auth.js";

/**
 * The per-account favorites surface (#414/WU2): `GET /favorites` lists the
 * caller's ids; `PUT`/`DELETE /favorites/:campaignId` add and remove. Every
 * route is AUTHENTICATED and the owner is always `request.principal.userId` —
 * a body- or query-supplied user is ignored. A non-UUID id is a 400 before the
 * repository is touched, an unknown campaign is a 404, and every failure is a
 * sanitized body.
 */
const CALLER_ID = principalFor("INVERSOR").userId;
const OTHER_ID = principalFor("PYME").userId;
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";

interface FakeRepository {
  readonly favorites: FavoriteRepositoryPort;
  readonly listCalls: string[];
  readonly addCalls: Array<{ userId: string; campaignId: string }>;
  readonly removeCalls: Array<{ userId: string; campaignId: string }>;
}

function fakeRepository(overrides: Partial<FavoriteRepositoryPort> = {}): FakeRepository {
  const listCalls: string[] = [];
  const addCalls: Array<{ userId: string; campaignId: string }> = [];
  const removeCalls: Array<{ userId: string; campaignId: string }> = [];

  const favorites: FavoriteRepositoryPort = {
    listCampaignIds: async (userId): Promise<FavoriteRepositoryResult<readonly string[]>> => {
      listCalls.push(userId);
      return { ok: true, value: [CAMPAIGN_ID] };
    },
    add: async (userId, campaignId): Promise<FavoriteRepositoryResult<{ readonly applied: boolean }>> => {
      addCalls.push({ userId, campaignId });
      return { ok: true, value: { applied: true } };
    },
    remove: async (userId, campaignId): Promise<FavoriteRepositoryResult<{ readonly applied: boolean }>> => {
      removeCalls.push({ userId, campaignId });
      return { ok: true, value: { applied: true } };
    },
    ...overrides
  };

  return { favorites, listCalls, addCalls, removeCalls };
}

function deps(favorites: FavoriteRepositoryPort): { favorites: FavoriteRepositoryPort } {
  return { favorites };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /favorites", () => {
  it("lists the caller's own campaign ids", async () => {
    const fake = fakeRepository();
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "GET", url: "/favorites" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ campaignIds: [CAMPAIGN_ID] });
    expect(fake.listCalls).toEqual([CALLER_ID]);
  });

  it("uses the verified principal, never a body/query user", async () => {
    const fake = fakeRepository();
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    await app.inject({ method: "GET", url: `/favorites?userId=${OTHER_ID}` });

    expect(fake.listCalls).toEqual([CALLER_ID]);
    expect(fake.listCalls).not.toContain(OTHER_ID);
  });

  it("answers 503 instead of an empty 200 when the repository is unavailable", async () => {
    const fake = fakeRepository({ listCampaignIds: async () => ({ ok: false, error: { code: "unavailable" } }) });
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "GET", url: "/favorites" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

describe("PUT /favorites/:campaignId", () => {
  it("adds the campaign for the caller and answers the result envelope", async () => {
    const fake = fakeRepository();
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "PUT", url: `/favorites/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ campaignId: CAMPAIGN_ID, applied: true });
    expect(fake.addCalls).toEqual([{ userId: CALLER_ID, campaignId: CAMPAIGN_ID }]);
  });

  it("is idempotent: a replayed add answers 200 with applied:false", async () => {
    const fake = fakeRepository({ add: async () => ({ ok: true, value: { applied: false } }) });
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "PUT", url: `/favorites/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ campaignId: CAMPAIGN_ID, applied: false });
  });

  it("answers 404 when the campaign does not exist", async () => {
    const fake = fakeRepository({ add: async () => ({ ok: false, error: { code: "not_found" } }) });
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "PUT", url: `/favorites/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "not_found" });
  });

  it("rejects a non-UUID id with 400 without touching the repository", async () => {
    const fake = fakeRepository();
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "PUT", url: "/favorites/not-a-uuid" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(fake.addCalls).toHaveLength(0);
  });

  it("answers 503 when the repository reports unavailable", async () => {
    const fake = fakeRepository({ add: async () => ({ ok: false, error: { code: "unavailable" } }) });
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "PUT", url: `/favorites/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("answers 401 without a token", async () => {
    const fake = fakeRepository();
    app = buildApp({ favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "PUT", url: `/favorites/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
    expect(fake.addCalls).toHaveLength(0);
  });
});

describe("DELETE /favorites/:campaignId", () => {
  it("removes the campaign for the caller and answers the result envelope", async () => {
    const fake = fakeRepository();
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "DELETE", url: `/favorites/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ campaignId: CAMPAIGN_ID, applied: true });
    expect(fake.removeCalls).toEqual([{ userId: CALLER_ID, campaignId: CAMPAIGN_ID }]);
  });

  it("is idempotent: removing a favorite that is not there answers 200 with applied:false", async () => {
    const fake = fakeRepository({ remove: async () => ({ ok: true, value: { applied: false } }) });
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "DELETE", url: `/favorites/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ campaignId: CAMPAIGN_ID, applied: false });
  });

  it("rejects a non-UUID id with 400 without touching the repository", async () => {
    const fake = fakeRepository();
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "DELETE", url: "/favorites/not-a-uuid" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(fake.removeCalls).toHaveLength(0);
  });

  it("answers 503 instead of a false success when the repository is unavailable", async () => {
    const fake = fakeRepository({ remove: async () => ({ ok: false, error: { code: "unavailable" } }) });
    app = buildAppAs("INVERSOR", { favorite: deps(fake.favorites) });

    const response = await app.inject({ method: "DELETE", url: `/favorites/${CAMPAIGN_ID}` });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

import type { FastifyInstance } from "fastify";
import type { FavoriteRepositoryPort } from "../../../application/ports/favorite-repository-port.js";
import { listFavorites } from "../../../application/use-cases/list-favorites.js";
import { setFavorite } from "../../../application/use-cases/set-favorite.js";

/**
 * The per-account favorites surface (#414/WU2).
 *
 * `GET /favorites` lists the signed-in caller's saved campaign ids; `PUT
 * /favorites/:campaignId` saves one and `DELETE /favorites/:campaignId` removes
 * it. All three are `AUTHENTICATED` for any role (see `route-policy.ts`), and
 * the owner is always `request.principal.userId` — a body- or query-supplied
 * user is ignored, so a caller can only ever touch its own rows.
 *
 * Every failure is a sanitized body: the repository adapter already returns no
 * provider text, and this route never adds any. A malformed id is a `400 {
 * code: "invalid_request" }` before the repository is touched; an unknown
 * campaign is a plain `404 { error: "not_found" }`; a repository that reports
 * `unavailable` is a `503 { code: "unavailable" }`, never a 200 that would
 * falsely confirm the change.
 */

export interface FavoriteRouteDependencies {
  readonly favorites: FavoriteRepositoryPort;
}

/**
 * The id format `gen_random_uuid()` writes. A malformed id is rejected before
 * the repository is touched, so an attacker cannot probe with arbitrary text.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function registerFavoriteRoute(app: FastifyInstance, dependencies: FavoriteRouteDependencies): void {
  app.get("/favorites", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await listFavorites({ favorites: dependencies.favorites }, principal.userId);
    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send(result.value);
  });

  app.put<{ Params: { campaignId: string } }>("/favorites/:campaignId", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const campaignId = request.params.campaignId;
    if (!UUID_PATTERN.test(campaignId)) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    const result = await setFavorite(
      { favorites: dependencies.favorites },
      { userId: principal.userId, campaignId, active: true }
    );
    if (!result.ok) {
      return result.error.code === "not_found"
        ? reply.code(404).send({ error: "not_found" })
        : reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send(result.value);
  });

  app.delete<{ Params: { campaignId: string } }>("/favorites/:campaignId", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const campaignId = request.params.campaignId;
    if (!UUID_PATTERN.test(campaignId)) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    const result = await setFavorite(
      { favorites: dependencies.favorites },
      { userId: principal.userId, campaignId, active: false }
    );
    if (!result.ok) {
      return result.error.code === "not_found"
        ? reply.code(404).send({ error: "not_found" })
        : reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send(result.value);
  });
}

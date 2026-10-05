import type { FastifyInstance } from "fastify";
import type { NotificationRepositoryPort } from "../../../application/ports/notification-repository-port.js";

/**
 * The in-app notification bell surface (Feature #382, Task #383 / T1c).
 *
 * `GET /notifications` lists the signed-in user's own rows, newest first;
 * `GET /notifications/unread-count` is the badge; `POST
 * /notifications/:notificationId/read` marks one and `POST
 * /notifications/read-all` marks every unread row. All four are `AUTHENTICATED`
 * for any role (see `route-policy.ts`), and the recipient is always
 * `request.principal.userId` — a body- or query-supplied recipient is ignored,
 * so a caller can only ever touch its own rows.
 *
 * Every failure is a sanitized body: the repository adapter already returns no
 * provider text, and this route never adds any. A repository read/write that
 * reports `unavailable` is a `503 { code: "unavailable" }`, never a 200 with
 * empty data. An unknown or foreign id is a plain `404 { error: "not_found" }`,
 * distinguishable from a malformed id's `400 { code: "invalid_request" }`.
 */

export interface NotificationRouteDependencies {
  readonly repository: NotificationRepositoryPort;
}

/**
 * The id format `gen_random_uuid()` writes. A malformed id is rejected before
 * the repository is touched, so an attacker cannot probe with arbitrary text.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function registerNotificationRoute(
  app: FastifyInstance,
  dependencies: NotificationRouteDependencies
): void {
  app.get("/notifications", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await dependencies.repository.listByRecipient(principal.userId);
    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send({ notifications: result.notifications });
  });

  app.get("/notifications/unread-count", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await dependencies.repository.countUnread(principal.userId);
    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send({ unread: result.unread });
  });

  app.post<{ Params: { notificationId: string } }>(
    "/notifications/:notificationId/read",
    async (request, reply) => {
      const principal = request.principal;
      if (principal === undefined) {
        return reply.code(401).send({ code: "unauthenticated" });
      }

      const notificationId = request.params.notificationId;
      if (!UUID_PATTERN.test(notificationId)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      // Scoped to the principal: a row that is not the caller's is a 404, never
      // a silent success or a 403 that would confirm the row exists.
      const result = await dependencies.repository.markRead(principal.userId, notificationId);
      if (!result.ok) {
        return reply.code(503).send({ code: "unavailable" });
      }
      if (!result.changed) {
        return reply.code(404).send({ error: "not_found" });
      }

      return reply.code(200).send({ read: true });
    }
  );

  app.post("/notifications/read-all", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await dependencies.repository.markAllRead(principal.userId);
    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send({ updated: result.updated });
  });
}

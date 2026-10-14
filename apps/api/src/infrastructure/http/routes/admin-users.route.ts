import {
  adminUsersQuerySchema,
  parseAcceptOperatorInvitationCommand,
  parseChangeUserRoleCommand,
  parseInviteOperatorCommand,
  parseSetChatAccessCommand,
  parseSetUserActiveCommand
} from "@vaqcrow/contracts";
import type { AdminUsersQuery } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { acceptOperatorInvitation } from "../../../application/admin-users/accept-operator-invitation.js";
import type {
  AcceptOperatorInvitationOutcome,
  AcceptOperatorInvitationRequest
} from "../../../application/admin-users/accept-operator-invitation.js";
import { changeUserRole } from "../../../application/admin-users/change-user-role.js";
import type {
  ChangeUserRoleOutcome,
  ChangeUserRoleRequest
} from "../../../application/admin-users/change-user-role.js";
import { inviteOperator } from "../../../application/admin-users/invite-operator.js";
import type {
  InviteOperatorOutcome,
  InviteOperatorRequest
} from "../../../application/admin-users/invite-operator.js";
import { setUserActivation } from "../../../application/admin-users/set-user-activation.js";
import type {
  SetUserActivationErrorCode,
  SetUserActivationOutcome,
  SetUserActivationRequest
} from "../../../application/admin-users/set-user-activation.js";
import { setChatAccess } from "../../../application/admin-users/set-chat-access.js";
import type {
  SetChatAccessOutcome,
  SetChatAccessRequest
} from "../../../application/admin-users/set-chat-access.js";
import type {
  AdminChatAccessWriterPort,
  AdminUserWriterPort
} from "../../../application/ports/admin-user-writer-port.js";
import type { AuditLogPort } from "../../../application/ports/audit-log-port.js";
import type { AdminUsersReaderPort } from "../../../application/ports/admin-users-reader-port.js";
import type { NotificationPublisherPort } from "../../../application/ports/notification-publisher-port.js";
import type { OperatorInviterPort } from "../../../application/ports/operator-inviter-port.js";
import type { OperatorProfileWriterPort } from "../../../application/ports/operator-profile-writer-port.js";

/**
 * The ADMIN users surface (Feature #390).
 *
 * WU2 added the read-only list: `GET /admin/users` decodes the query into the
 * shared `AdminUsersQuery` with `adminUsersQuerySchema` (`page`/`pageSize`
 * default to 1/20); unknown keys, a non-numeric page or a `pageSize` over 100
 * are a `400 { code: "invalid_request" }` before the reader is touched. The
 * caller is always `request.principal`; `principal.userId` only feeds `isSelf`.
 *
 * WU3a adds the two mutations, both `ADMIN`-only by the route-policy table:
 * `POST /admin/users/:userId/activation` (body `{ active }`) and
 * `POST /admin/users/:userId/role` (body `{ role: "PYME" | "INVERSOR" }`). The
 * body is validated with the WU1 command schemas (strict: an `actor` field is a
 * `400`, never ignored); a malformed `:userId` is a `400`. The actor is the
 * verified principal, never request data. Domain rejections are a `409` with a
 * specific code, an unknown user is `404`, and any provider failure — returned
 * or thrown — is a sanitized `503 { code: "unavailable" }`.
 *
 * WU3b adds `POST /admin/invitations` (body `{ email }`, also `ADMIN`-only).
 * The body is validated with `parseInviteOperatorCommand` (strict: any extra
 * field is a `400`); the use case creates and promotes the operator, appends
 * one audit entry and publishes the in-app event best-effort. An address that
 * already has an account is a `409 { code: "email_exists" }`; any other failure
 * is a sanitized `503`.
 *
 * WU5 adds `POST /admin/invitations/accept` (body `{ displayName }`), the one
 * route here that is `AUTHENTICATED` rather than `ADMIN`-only: the invitee
 * edits only their own profile row, so the actor is always the verified
 * principal and the body can never name another user. The password is set
 * client-side and is not part of the command. A missing profile is `404`; any
 * provider failure — returned or thrown — is a sanitized `503`.
 */

export const DEFAULT_ADMIN_USERS_PAGE = 1;
export const DEFAULT_ADMIN_USERS_PAGE_SIZE = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AdminUsersRouteDependencies {
  readonly users: AdminUsersReaderPort;
  readonly setActivation: (request: SetUserActivationRequest) => Promise<SetUserActivationOutcome>;
  readonly changeRole: (request: ChangeUserRoleRequest) => Promise<ChangeUserRoleOutcome>;
  readonly invite: (request: InviteOperatorRequest) => Promise<InviteOperatorOutcome>;
  readonly acceptInvitation: (
    request: AcceptOperatorInvitationRequest
  ) => Promise<AcceptOperatorInvitationOutcome>;
  /** The per-user assistant access toggle (#499/WU2, D9). */
  readonly setChatAccess: (request: SetChatAccessRequest) => Promise<SetChatAccessOutcome>;
}

/** Composition-root helper keeps the routes' dependencies vendor-free ports. */
export function createAdminUsersRouteDependencies(
  users: AdminUsersReaderPort,
  writer: AdminUserWriterPort,
  audit: AuditLogPort,
  profileWriter: OperatorProfileWriterPort,
  inviter: OperatorInviterPort,
  notifications: Pick<NotificationPublisherPort, "publish">,
  chatAccess: AdminChatAccessWriterPort
): AdminUsersRouteDependencies {
  const useCases = { users: writer, audit };
  return {
    users,
    setActivation: (request) => setUserActivation(useCases, request),
    changeRole: (request) => changeUserRole(useCases, request),
    invite: (request) => inviteOperator({ inviter, audit, notifications }, request),
    acceptInvitation: (request) => acceptOperatorInvitation({ profile: profileWriter, audit }, request),
    setChatAccess: (request) => setChatAccess({ users: chatAccess, audit }, request)
  };
}

function asRecord(query: unknown): Record<string, unknown> | undefined {
  if (typeof query !== "object" || query === null || Array.isArray(query)) return undefined;
  return query as Record<string, unknown>;
}

/** Fastify hands query values as strings; a non-numeric one stays `"invalid"`. */
function integerParam(value: unknown): number | "invalid" | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : "invalid";
  }
  return "invalid";
}

/**
 * Normalizes the raw query into the schema's shape: numbers for `page`/
 * `pageSize` (defaulted when absent) and the raw object spread in so
 * `strictObject` still rejects an unknown key.
 */
export function parseAdminUsersQueryParams(query: unknown): AdminUsersQuery | undefined {
  const record = asRecord(query);
  if (record === undefined) return undefined;

  const page = integerParam(record["page"]);
  const pageSize = integerParam(record["pageSize"]);
  if (page === "invalid" || pageSize === "invalid") return undefined;

  const parsed = adminUsersQuerySchema.safeParse({
    ...record,
    page: page ?? DEFAULT_ADMIN_USERS_PAGE,
    pageSize: pageSize ?? DEFAULT_ADMIN_USERS_PAGE_SIZE
  });
  return parsed.success ? parsed.data : undefined;
}

/**
 * A domain rejection is a conflict; an unknown user is `404`; a provider failure
 * is `503`. Activation and role share this mapping (the role-only code is added
 * on top below).
 */
function statusForActivationError(code: SetUserActivationErrorCode): number {
  if (code === "not_found") return 404;
  if (code === "unavailable") return 503;
  return 409;
}

export function registerAdminUsersRoute(
  app: FastifyInstance,
  dependencies: AdminUsersRouteDependencies
): void {
  app.get("/admin/users", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const query = parseAdminUsersQueryParams(request.query);
    if (query === undefined) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    try {
      const result = await dependencies.users.list(query, principal.userId);
      if (!result.ok) {
        return reply.code(503).send({ code: "unavailable" });
      }

      return reply.code(200).send(result.value);
    } catch {
      // The port contract is to return `unavailable`, never throw; if an adapter
      // breaks it, the failure is still a sanitized 503, never a 500 that could
      // echo the thrown message.
      return reply.code(503).send({ code: "unavailable" });
    }
  });

  app.post<{ Params: { userId: string }; Body: unknown }>(
    "/admin/users/:userId/activation",
    async (request, reply) => {
      const principal = request.principal;
      if (principal === undefined) {
        return reply.code(401).send({ code: "unauthenticated" });
      }

      const userId = request.params.userId;
      if (!UUID.test(userId)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      let active: boolean;
      try {
        active = parseSetUserActiveCommand(request.body).active;
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      try {
        const result = await dependencies.setActivation({
          targetUserId: userId,
          active,
          actorUserId: principal.userId,
          correlationId: request.id
        });
        if (result.ok) {
          return reply.code(200).send(result.value);
        }
        return reply.code(statusForActivationError(result.error.code)).send({ code: result.error.code });
      } catch {
        return reply.code(503).send({ code: "unavailable" });
      }
    }
  );

  app.post<{ Params: { userId: string }; Body: unknown }>(
    "/admin/users/:userId/role",
    async (request, reply) => {
      const principal = request.principal;
      if (principal === undefined) {
        return reply.code(401).send({ code: "unauthenticated" });
      }

      const userId = request.params.userId;
      if (!UUID.test(userId)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      let role: ChangeUserRoleRequest["role"];
      try {
        role = parseChangeUserRoleCommand(request.body).role;
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      try {
        const result = await dependencies.changeRole({
          targetUserId: userId,
          role,
          actorUserId: principal.userId,
          correlationId: request.id
        });
        if (result.ok) {
          return reply.code(200).send(result.value);
        }
        const status =
          result.error.code === "not_found"
            ? 404
            : result.error.code === "unavailable"
              ? 503
              : 409;
        return reply.code(status).send({ code: result.error.code });
      } catch {
        return reply.code(503).send({ code: "unavailable" });
      }
    }
  );

  app.post<{ Body: unknown }>("/admin/invitations", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    let email: string;
    try {
      email = parseInviteOperatorCommand(request.body).email;
    } catch {
      return reply.code(400).send({ code: "invalid_request" });
    }

    try {
      const result = await dependencies.invite({
        email,
        actorUserId: principal.userId,
        correlationId: request.id
      });
      if (result.ok) {
        return reply.code(200).send(result.value);
      }
      return reply
        .code(result.error.code === "email_exists" ? 409 : 503)
        .send({ code: result.error.code });
    } catch {
      return reply.code(503).send({ code: "unavailable" });
    }
  });

  // WU5: the invited operator accepts. AUTHENTICATED, not ADMIN-only, because
  // the route only ever edits the caller's own profile row — the user id comes
  // from the verified principal, never the body. The password is set
  // client-side against Supabase Auth and never crosses this API.
  app.post<{ Body: unknown }>("/admin/invitations/accept", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    let displayName: string;
    try {
      displayName = parseAcceptOperatorInvitationCommand(request.body).displayName;
    } catch {
      return reply.code(400).send({ code: "invalid_request" });
    }

    try {
      const result = await dependencies.acceptInvitation({
        displayName,
        actorUserId: principal.userId,
        correlationId: request.id
      });
      if (result.ok) {
        return reply.code(200).send(result.value);
      }
      return reply
        .code(result.error.code === "not_found" ? 404 : 503)
        .send({ code: result.error.code });
    } catch {
      return reply.code(503).send({ code: "unavailable" });
    }
  });

  // The per-user assistant access toggle (#499/WU2, D9): ADMIN-only. The flag is
  // off by default; this is the only way to grant it. The actor is the verified
  // principal, never the body.
  app.post<{ Params: { userId: string }; Body: unknown }>(
    "/admin/users/:userId/chat-access",
    async (request, reply) => {
      const principal = request.principal;
      if (principal === undefined) {
        return reply.code(401).send({ code: "unauthenticated" });
      }

      const userId = request.params.userId;
      if (!UUID.test(userId)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      let enabled: boolean;
      try {
        enabled = parseSetChatAccessCommand(request.body).enabled;
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      try {
        const result = await dependencies.setChatAccess({
          targetUserId: userId,
          enabled,
          actorUserId: principal.userId,
          correlationId: request.id
        });
        if (result.ok) {
          return reply.code(200).send(result.value);
        }
        return reply
          .code(result.error.code === "not_found" ? 404 : 503)
          .send({ code: result.error.code });
      } catch {
        return reply.code(503).send({ code: "unavailable" });
      }
    }
  );
}

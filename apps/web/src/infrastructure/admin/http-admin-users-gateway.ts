import axios, { type AxiosInstance } from "axios";
import {
  parseAdminUsersPage,
  parseAuditLogPage,
  parseInviteOperatorResult
} from "@vaqcrow/contracts";
import type {
  AdminUsersQuery,
  AuditLogQuery,
  ChangeUserRoleCommand,
  InviteOperatorCommand,
  InviteOperatorResult,
  SetChatAccessCommand,
  SetUserActiveCommand
} from "@vaqcrow/contracts";
import type {
  AdminUsersMutationErrorCode,
  AdminUsersMutationResult,
  AdminUsersPageResult,
  AdminUsersPort,
  AuditLogResult,
  InviteOperatorOutcome
} from "@/application/admin/users";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for admin › Usuarios (Feature #390), talking to the ADMIN-only
 * endpoints `GET /admin/users`, `GET /admin/audit-log`,
 * `POST /admin/users/:id/activation`, `POST /admin/users/:id/role` and
 * `POST /admin/invitations`, with the signed-in session's
 * `Authorization: Bearer` token.
 *
 * Every success body is parsed through the contract parsers; a malformed body
 * collapses to the sanitized `unavailable` instead of rendering. A `404` is
 * `not_found`; a `409` carries the API's own sanitized code when it is one this
 * boundary understands, and `unavailable` otherwise; a transport failure is
 * `network`. The envelope's raw `message`/`details` never cross this boundary.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

/** The 409 codes the mutations can return; anything else collapses to `unavailable`. */
const MUTATION_CONFLICT_CODES: ReadonlySet<string> = new Set([
  "self",
  "last_admin",
  "already_inactive",
  "target_is_admin",
  "unchanged",
  "role_not_allowed",
  "email_exists"
]);

async function headersFor(provider: AccessTokenProvider | undefined): Promise<Record<string, string> | undefined> {
  if (!provider) return undefined;
  let token: string | null;
  try {
    token = await provider();
  } catch {
    return undefined;
  }
  return typeof token === "string" && BEARER_TOKEN_PATTERN.test(token) ? { Authorization: `Bearer ${token}` } : undefined;
}

/** The sanitized `{ code }` the API sends with an error status, if it is one. */
function conflictCodeOf(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const code = (data as Record<string, unknown>).code;
  return typeof code === "string" && MUTATION_CONFLICT_CODES.has(code) ? code : undefined;
}

/** Guards the activation response: the echoed `{ userId, active }` must match the request. */
function matchesActive(data: unknown, userId: string, command: SetUserActiveCommand): boolean {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return record.userId === userId && record.active === command.active;
}

/** Guards the role-change response: the echoed `{ userId, role }` must match the request. */
function matchesRole(data: unknown, userId: string, command: ChangeUserRoleCommand): boolean {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return record.userId === userId && record.role === command.role;
}

/** Guards the assistant-access response: the echoed `{ userId, enabled }` must match the request. */
function matchesChatAccess(data: unknown, userId: string, command: SetChatAccessCommand): boolean {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return record.userId === userId && record.enabled === command.enabled;
}

function usersParams(query: AdminUsersQuery): Record<string, string | number> {
  return {
    page: query.page,
    pageSize: query.pageSize,
    ...(query.search === undefined ? {} : { search: query.search }),
    ...(query.role === undefined ? {} : { role: query.role }),
    ...(query.status === undefined ? {} : { status: query.status })
  };
}

function auditParams(query: AuditLogQuery): Record<string, string | number> {
  return {
    page: query.page,
    pageSize: query.pageSize,
    ...(query.search === undefined ? {} : { search: query.search })
  };
}

export class HttpAdminUsersGateway implements AdminUsersPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpAdminUsersGateway {
    return new HttpAdminUsersGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  async listUsers(query: AdminUsersQuery): Promise<AdminUsersPageResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/admin/users", {
        params: usersParams(query),
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      try {
        return { ok: true, page: parseAdminUsersPage(response.data) };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async listAudit(query: AuditLogQuery): Promise<AuditLogResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/admin/audit-log", {
        params: auditParams(query),
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      try {
        return { ok: true, page: parseAuditLogPage(response.data) };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async setUserActive(userId: string, command: SetUserActiveCommand): Promise<AdminUsersMutationResult> {
    return this.mutate(`/admin/users/${encodeURIComponent(userId)}/activation`, { active: command.active }, (data) =>
      matchesActive(data, userId, command)
    );
  }

  async changeUserRole(userId: string, command: ChangeUserRoleCommand): Promise<AdminUsersMutationResult> {
    return this.mutate(`/admin/users/${encodeURIComponent(userId)}/role`, { role: command.role }, (data) =>
      matchesRole(data, userId, command)
    );
  }

  async setChatAccess(userId: string, command: SetChatAccessCommand): Promise<AdminUsersMutationResult> {
    return this.mutate(
      `/admin/users/${encodeURIComponent(userId)}/chat-access`,
      { enabled: command.enabled },
      (data) => matchesChatAccess(data, userId, command)
    );
  }

  async inviteOperator(command: InviteOperatorCommand): Promise<InviteOperatorOutcome> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.post(
        "/admin/invitations",
        { email: command.email },
        { ...(headers ? { headers } : {}), validateStatus: () => true }
      );
      if (response.status === 200) {
        try {
          const invitation: InviteOperatorResult = parseInviteOperatorResult(response.data);
          return { ok: true, invitation };
        } catch {
          return { ok: false, code: "unavailable" };
        }
      }
      return { ok: false, code: this.failureCode(response.status, response.data) };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  /** Shared POST flow for the two activation/role mutations. */
  private async mutate(
    url: string,
    body: Record<string, unknown>,
    isEchoValid: (data: unknown) => boolean
  ): Promise<AdminUsersMutationResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.post(url, body, {
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status === 200) {
        return isEchoValid(response.data) ? { ok: true } : { ok: false, code: "unavailable" };
      }
      return { ok: false, code: this.failureCode(response.status, response.data) };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  /** A `404` is `not_found`; a recognized `409` keeps its code; anything else is `unavailable`. */
  private failureCode(status: number, data: unknown): AdminUsersMutationErrorCode {
    if (status === 404) return "not_found";
    const conflict = conflictCodeOf(data);
    return conflict === undefined ? "unavailable" : (conflict as AdminUsersMutationErrorCode);
  }
}

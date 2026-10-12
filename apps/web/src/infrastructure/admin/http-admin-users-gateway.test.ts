import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import type { AdminUsersQuery, AuditLogQuery } from "@vaqcrow/contracts";
import { HttpAdminUsersGateway } from "./http-admin-users-gateway";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const WIRE_USER = {
  userId: USER_ID,
  displayName: "Lucía Fernández",
  email: "lucia.f@demo.ar",
  role: "INVERSOR",
  status: "active",
  lastActivityAt: "2026-09-11T12:00:00.000Z",
  kycStatus: "approved_simulated",
  isSelf: false
};

const WIRE_USERS_PAGE = { items: [WIRE_USER], total: 41, page: 2, pageSize: 20 };

const WIRE_AUDIT_PAGE = {
  items: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      occurredAt: "2026-09-13T09:15:00.000Z",
      actorUserId: "33333333-3333-4333-8333-333333333333",
      actorDisplayName: "M. Pereyra",
      action: "user.deactivated",
      targetType: "user",
      targetId: USER_ID,
      summary: "M. Pereyra desactivó a Lucía Fernández"
    }
  ],
  total: 3,
  page: 1,
  pageSize: 10
};

interface Call {
  readonly method: string;
  readonly url: string;
  readonly params: Record<string, unknown> | undefined;
  readonly body: unknown;
  readonly headers: Record<string, string> | undefined;
}

function fakeClient(wire: { status: number; data: unknown } | Error) {
  const calls: Call[] = [];
  const client = {
    get: async (url: string, config: { params?: Record<string, unknown>; headers?: Record<string, string> } = {}) => {
      calls.push({ method: "get", url, params: config.params, body: undefined, headers: config.headers });
      if (wire instanceof Error) throw wire;
      return wire;
    },
    post: async (
      url: string,
      body: unknown,
      config: { headers?: Record<string, string> } = {}
    ) => {
      calls.push({ method: "post", url, params: undefined, body, headers: config.headers });
      if (wire instanceof Error) throw wire;
      return wire;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

const USERS_QUERY: AdminUsersQuery = { page: 2, pageSize: 20, search: "lucía", role: "INVERSOR", status: "active" };
const AUDIT_QUERY: AuditLogQuery = { page: 1, pageSize: 10, search: "rol" };

describe("HttpAdminUsersGateway.listUsers", () => {
  it("reads the users page with the Bearer token and the resolved query", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE_USERS_PAGE });
    const gateway = new HttpAdminUsersGateway(client, async () => "token-123");

    const result = await gateway.listUsers(USERS_QUERY);

    expect(result).toEqual({ ok: true, page: WIRE_USERS_PAGE });
    expect(calls[0]!.url).toBe("/admin/users");
    expect(calls[0]!.params).toEqual({
      page: 2,
      pageSize: 20,
      search: "lucía",
      role: "INVERSOR",
      status: "active"
    });
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
  });

  it("omits search, role and status when unset and sends no header without a provider", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { ...WIRE_USERS_PAGE, items: [] } });
    const gateway = new HttpAdminUsersGateway(client);

    await gateway.listUsers({ page: 1, pageSize: 20 });

    expect(calls[0]!.params).toEqual({ page: 1, pageSize: 20 });
    expect(calls[0]!.headers).toBeUndefined();
  });

  it("rejects a malformed page instead of rendering it", async () => {
    const { client } = fakeClient({ status: 200, data: { ...WIRE_USERS_PAGE, total: "many" } });
    const gateway = new HttpAdminUsersGateway(client);

    expect(await gateway.listUsers(USERS_QUERY)).toEqual({ ok: false, code: "unavailable" });
  });

  it("rejects a page whose user has an unknown role", async () => {
    const { client } = fakeClient({
      status: 200,
      data: { ...WIRE_USERS_PAGE, items: [{ ...WIRE_USER, role: "VISITANTE" }] }
    });
    const gateway = new HttpAdminUsersGateway(client);

    expect(await gateway.listUsers(USERS_QUERY)).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a non-200 status and a transport failure to the sanitized codes", async () => {
    const forbidden = new HttpAdminUsersGateway(fakeClient({ status: 403, data: { code: "forbidden" } }).client);
    expect(await forbidden.listUsers(USERS_QUERY)).toEqual({ ok: false, code: "unavailable" });

    const offline = new HttpAdminUsersGateway(fakeClient(new Error("boom")).client);
    expect(await offline.listUsers(USERS_QUERY)).toEqual({ ok: false, code: "network" });
  });
});

describe("HttpAdminUsersGateway.listAudit", () => {
  it("reads the audit page with the resolved query", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE_AUDIT_PAGE });
    const gateway = new HttpAdminUsersGateway(client, async () => "token-123");

    const result = await gateway.listAudit(AUDIT_QUERY);

    expect(result).toEqual({ ok: true, page: WIRE_AUDIT_PAGE });
    expect(calls[0]!.url).toBe("/admin/audit-log");
    expect(calls[0]!.params).toEqual({ page: 1, pageSize: 10, search: "rol" });
  });

  it("rejects a malformed audit page", async () => {
    const { client } = fakeClient({ status: 200, data: { items: [{ id: "nope" }], total: 1, page: 1, pageSize: 10 } });
    const gateway = new HttpAdminUsersGateway(client);

    expect(await gateway.listAudit(AUDIT_QUERY)).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("HttpAdminUsersGateway.setUserActive", () => {
  it("posts the activation command and resolves ok on a matching echo", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { userId: USER_ID, active: false } });
    const gateway = new HttpAdminUsersGateway(client, async () => "token-123");

    const result = await gateway.setUserActive(USER_ID, { active: false });

    expect(result).toEqual({ ok: true });
    expect(calls[0]!.url).toBe(`/admin/users/${USER_ID}/activation`);
    expect(calls[0]!.body).toEqual({ active: false });
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
  });

  it("rejects a mismatched echo instead of trusting the status code", async () => {
    const { client } = fakeClient({ status: 200, data: { userId: USER_ID, active: true } });
    const gateway = new HttpAdminUsersGateway(client);

    expect(await gateway.setUserActive(USER_ID, { active: false })).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps 404 to not_found and a recognized 409 to its own code", async () => {
    const missing = new HttpAdminUsersGateway(fakeClient({ status: 404, data: { code: "not_found" } }).client);
    expect(await missing.setUserActive(USER_ID, { active: false })).toEqual({ ok: false, code: "not_found" });

    const self = new HttpAdminUsersGateway(fakeClient({ status: 409, data: { code: "self" } }).client);
    expect(await self.setUserActive(USER_ID, { active: false })).toEqual({ ok: false, code: "self" });

    const lastAdmin = new HttpAdminUsersGateway(fakeClient({ status: 409, data: { code: "last_admin" } }).client);
    expect(await lastAdmin.setUserActive(USER_ID, { active: false })).toEqual({ ok: false, code: "last_admin" });
  });

  it("collapses an unknown 409 code and a transport failure", async () => {
    const unknown = new HttpAdminUsersGateway(fakeClient({ status: 409, data: { code: "mystery" } }).client);
    expect(await unknown.setUserActive(USER_ID, { active: false })).toEqual({ ok: false, code: "unavailable" });

    const offline = new HttpAdminUsersGateway(fakeClient(new Error("boom")).client);
    expect(await offline.setUserActive(USER_ID, { active: false })).toEqual({ ok: false, code: "network" });
  });
});

describe("HttpAdminUsersGateway.changeUserRole", () => {
  it("posts the role command and resolves ok on a matching echo", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { userId: USER_ID, role: "PYME" } });
    const gateway = new HttpAdminUsersGateway(client);

    const result = await gateway.changeUserRole(USER_ID, { role: "PYME" });

    expect(result).toEqual({ ok: true });
    expect(calls[0]!.url).toBe(`/admin/users/${USER_ID}/role`);
    expect(calls[0]!.body).toEqual({ role: "PYME" });
  });

  it("maps target_is_admin and unchanged conflicts to their codes", async () => {
    const admin = new HttpAdminUsersGateway(fakeClient({ status: 409, data: { code: "target_is_admin" } }).client);
    expect(await admin.changeUserRole(USER_ID, { role: "PYME" })).toEqual({ ok: false, code: "target_is_admin" });

    const same = new HttpAdminUsersGateway(fakeClient({ status: 409, data: { code: "unchanged" } }).client);
    expect(await same.changeUserRole(USER_ID, { role: "PYME" })).toEqual({ ok: false, code: "unchanged" });
  });
});

describe("HttpAdminUsersGateway.inviteOperator", () => {
  it("posts the email and parses the invitation result", async () => {
    const invitation = { userId: USER_ID, email: "l.gomez@vaqcrow.demo", status: "invited" };
    const { client, calls } = fakeClient({ status: 200, data: invitation });
    const gateway = new HttpAdminUsersGateway(client, async () => "token-123");

    const result = await gateway.inviteOperator({ email: "l.gomez@vaqcrow.demo" });

    expect(result).toEqual({ ok: true, invitation });
    expect(calls[0]!.url).toBe("/admin/invitations");
    expect(calls[0]!.body).toEqual({ email: "l.gomez@vaqcrow.demo" });
  });

  it("maps email_exists and rejects a malformed invitation body", async () => {
    const exists = new HttpAdminUsersGateway(fakeClient({ status: 409, data: { code: "email_exists" } }).client);
    expect(await exists.inviteOperator({ email: "l.gomez@vaqcrow.demo" })).toEqual({
      ok: false,
      code: "email_exists"
    });

    const malformed = new HttpAdminUsersGateway(fakeClient({ status: 200, data: { email: "l.gomez@vaqcrow.demo" } }).client);
    expect(await malformed.inviteOperator({ email: "l.gomez@vaqcrow.demo" })).toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});

import { parseAdminUsersPage } from "@vaqcrow/contracts";
import type { AdminUsersPage } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminUsersReaderPort } from "../../../application/ports/admin-users-reader-port.js";
import { buildApp } from "../build-app.js";
import { bearer, fakeAuthPort, principalFor } from "../test-support/auth.js";
import type { AdminUsersRouteDependencies } from "./admin-users.route.js";
import { parseAdminUsersQueryParams } from "./admin-users.route.js";

const URL = "/admin/users";
const ADMIN_ID = principalFor("ADMIN").userId;
const USER_ID = "11111111-1111-4111-8111-111111111111";
const ACTIVATION_URL = `/admin/users/${USER_ID}/activation`;
const ROLE_URL = `/admin/users/${USER_ID}/role`;
const INVITATIONS_URL = "/admin/invitations";
const ACCEPT_URL = "/admin/invitations/accept";
const INVITED_EMAIL = "operador@vaqcrow.com";

const PAGE: AdminUsersPage = parseAdminUsersPage({
  items: [
    {
      userId: "11111111-1111-4111-8111-111111111111",
      displayName: "Ana Inversora",
      email: "ana@vaqcrow.com",
      role: "INVERSOR",
      status: "active",
      lastActivityAt: "2026-10-12T13:00:00.000Z",
      kycStatus: "approved_simulated",
      isSelf: false
    }
  ],
  total: 1,
  page: 1,
  pageSize: 20
});

function appFor(list: AdminUsersReaderPort["list"]): FastifyInstance {
  return buildApp({
    adminUsers: {
      users: { list },
      setActivation: vi.fn(),
      changeRole: vi.fn(),
      invite: vi.fn(),
      acceptInvitation: vi.fn()
    },
    auth: { port: fakeAuthPort() }
  });
}

function mutationsApp(overrides: Partial<AdminUsersRouteDependencies> = {}): FastifyInstance {
  return buildApp({
    adminUsers: {
      users: { list: vi.fn() },
      setActivation: vi.fn().mockResolvedValue({ ok: true, value: { userId: USER_ID, active: false } }),
      changeRole: vi.fn().mockResolvedValue({ ok: true, value: { userId: USER_ID, role: "INVERSOR" } }),
      invite: vi.fn().mockResolvedValue({
        ok: true,
        value: { userId: USER_ID, email: INVITED_EMAIL, status: "invited" }
      }),
      acceptInvitation: vi.fn().mockResolvedValue({
        ok: true,
        value: { userId: USER_ID, displayName: "Ana Operadora" }
      }),
      ...overrides
    },
    auth: { port: fakeAuthPort() }
  });
}

describe("parseAdminUsersQueryParams", () => {
  it("defaults page and pageSize and validates optional filters", () => {
    expect(parseAdminUsersQueryParams({})).toEqual({ page: 1, pageSize: 20 });
    expect(
      parseAdminUsersQueryParams({ search: "ana", role: "INVERSOR", status: "invited", page: "2", pageSize: "50" })
    ).toEqual({ search: "ana", role: "INVERSOR", status: "invited", page: 2, pageSize: 50 });
  });

  it.each([
    { pageSize: "101" },
    { pageSize: "0" },
    { page: "0" },
    { page: "abc" },
    { page: "" },
    { sort: "name" },
    { page: "1", pageSize: "20", search: "" }
  ])("rejects malformed query %o", (query) => {
    expect(parseAdminUsersQueryParams(query)).toBeUndefined();
  });
});

describe("GET /admin/users", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it("returns the page for an ADMIN, parsed with the contract, defaulting the query", async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, value: PAGE });
    app = appFor(list);

    const response = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(200);
    expect(parseAdminUsersPage(response.json())).toEqual(PAGE);
    expect(list).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 20 }, ADMIN_ID);
  });

  it("passes search, filters and pagination through to the reader", async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, value: PAGE });
    app = appFor(list);

    await app.inject({
      method: "GET",
      url: `${URL}?search=ana&role=INVERSOR&status=active&page=2&pageSize=50`,
      headers: bearer("ADMIN")
    });

    expect(list).toHaveBeenCalledExactlyOnceWith(
      { search: "ana", role: "INVERSOR", status: "active", page: 2, pageSize: 50 },
      ADMIN_ID
    );
  });

  it.each([
    "pageSize=101",
    "page=0",
    "page=abc",
    "sort=name"
  ])("answers 400 for a malformed query (%s) without touching the reader", async (query) => {
    const list = vi.fn();
    app = appFor(list);

    const response = await app.inject({ method: "GET", url: `${URL}?${query}`, headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(list).not.toHaveBeenCalled();
  });

  it("answers 401 without a token", async () => {
    const list = vi.fn();
    app = appFor(list);

    const response = await app.inject({ method: "GET", url: URL });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
    expect(list).not.toHaveBeenCalled();
  });

  it.each(["PYME", "INVERSOR"] as const)("rejects %s with 403 before reading", async (role) => {
    const list = vi.fn();
    app = appFor(list);

    const response = await app.inject({ method: "GET", url: URL, headers: bearer(role) });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
    expect(list).not.toHaveBeenCalled();
  });

  it("maps a reader failure to a bare 503", async () => {
    app = appFor(vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }));

    const response = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("maps a thrown dependency to a sanitized 503 that never echoes the error", async () => {
    app = appFor(vi.fn().mockRejectedValue(new Error("secret detail")));

    const response = await app.inject({ method: "GET", url: URL, headers: bearer("ADMIN") });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
    expect(response.body).not.toMatch(/secret/);
  });
});

describe("POST /admin/users/:userId/activation", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  async function post(
    list: AdminUsersRouteDependencies["setActivation"],
    body: unknown,
    role: "ADMIN" | "PYME" | "INVERSOR" = "ADMIN",
    url = ACTIVATION_URL
  ) {
    app = mutationsApp({ setActivation: list });
    return app.inject({ method: "POST", url, headers: bearer(role), payload: body as object });
  }

  it("activates for an ADMIN and passes the verified actor, never a body identity", async () => {
    const setActivation = vi.fn().mockResolvedValue({ ok: true, value: { userId: USER_ID, active: false } });

    const response = await post(setActivation, { active: false });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: USER_ID, active: false });
    expect(setActivation).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        targetUserId: USER_ID,
        active: false,
        actorUserId: ADMIN_ID,
        correlationId: expect.any(String)
      })
    );
  });

  it.each([
    [{ active: "yes" }],
    [{}],
    [{ active: true, actorUserId: ADMIN_ID }],
    [null]
  ])("answers 400 for a malformed body (%o) without calling the use case", async (body) => {
    const setActivation = vi.fn();

    const response = await post(setActivation, body);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(setActivation).not.toHaveBeenCalled();
  });

  it("answers 400 for a malformed userId", async () => {
    const setActivation = vi.fn();

    const response = await post(setActivation, { active: true }, "ADMIN", "/admin/users/not-a-uuid/activation");

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(setActivation).not.toHaveBeenCalled();
  });

  it("answers 401 without a token", async () => {
    const setActivation = vi.fn();
    app = mutationsApp({ setActivation });

    const response = await app.inject({ method: "POST", url: ACTIVATION_URL, payload: { active: true } });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
    expect(setActivation).not.toHaveBeenCalled();
  });

  it.each(["PYME", "INVERSOR"] as const)("rejects %s with 403 before the use case", async (role) => {
    const setActivation = vi.fn();

    const response = await post(setActivation, { active: true }, role);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
    expect(setActivation).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404],
    ["self", 409],
    ["last_admin", 409],
    ["already_inactive", 409],
    ["unavailable", 503]
  ] as const)("maps the use-case code %s to %i", async (code, status) => {
    const setActivation = vi.fn().mockResolvedValue({ ok: false, error: { code } });

    const response = await post(setActivation, { active: false });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ code });
  });

  it("maps a thrown dependency to a sanitized 503 that never echoes the error", async () => {
    const setActivation = vi.fn().mockRejectedValue(new Error("secret detail"));

    const response = await post(setActivation, { active: true });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
    expect(response.body).not.toMatch(/secret/);
  });
});

describe("POST /admin/users/:userId/role", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  async function post(
    changeRole: AdminUsersRouteDependencies["changeRole"],
    body: unknown,
    role: "ADMIN" | "PYME" | "INVERSOR" = "ADMIN",
    url = ROLE_URL
  ) {
    app = mutationsApp({ changeRole });
    return app.inject({ method: "POST", url, headers: bearer(role), payload: body as object });
  }

  it("changes the role for an ADMIN and passes the verified actor", async () => {
    const changeRole = vi.fn().mockResolvedValue({ ok: true, value: { userId: USER_ID, role: "INVERSOR" } });

    const response = await post(changeRole, { role: "INVERSOR" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: USER_ID, role: "INVERSOR" });
    expect(changeRole).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        targetUserId: USER_ID,
        role: "INVERSOR",
        actorUserId: ADMIN_ID,
        correlationId: expect.any(String)
      })
    );
  });

  it.each([[{ role: "ADMIN" }], [{ role: "PEPE" }], [{}]])(
    "answers 400 for a malformed body (%o) without calling the use case",
    async (body) => {
      const changeRole = vi.fn();

      const response = await post(changeRole, body);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ code: "invalid_request" });
      expect(changeRole).not.toHaveBeenCalled();
    }
  );

  it("answers 400 for a malformed userId", async () => {
    const changeRole = vi.fn();

    const response = await post(changeRole, { role: "INVERSOR" }, "ADMIN", "/admin/users/nope/role");

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(changeRole).not.toHaveBeenCalled();
  });

  it("answers 401 without a token", async () => {
    const changeRole = vi.fn();
    app = mutationsApp({ changeRole });

    const response = await app.inject({ method: "POST", url: ROLE_URL, payload: { role: "INVERSOR" } });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
    expect(changeRole).not.toHaveBeenCalled();
  });

  it.each(["PYME", "INVERSOR"] as const)("rejects %s with 403 before the use case", async (role) => {
    const changeRole = vi.fn();

    const response = await post(changeRole, { role: "INVERSOR" }, role);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
    expect(changeRole).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404],
    ["target_is_admin", 409],
    ["unchanged", 409],
    ["role_not_allowed", 409],
    ["unavailable", 503]
  ] as const)("maps the use-case code %s to %i", async (code, status) => {
    const changeRole = vi.fn().mockResolvedValue({ ok: false, error: { code } });

    const response = await post(changeRole, { role: "INVERSOR" });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ code });
  });

  it("maps a thrown dependency to a sanitized 503 that never echoes the error", async () => {
    const changeRole = vi.fn().mockRejectedValue(new Error("secret detail"));

    const response = await post(changeRole, { role: "INVERSOR" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
    expect(response.body).not.toMatch(/secret/);
  });
});

describe("POST /admin/invitations", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  async function post(
    invite: AdminUsersRouteDependencies["invite"],
    body: unknown,
    role: "ADMIN" | "PYME" | "INVERSOR" = "ADMIN"
  ) {
    app = mutationsApp({ invite });
    return app.inject({ method: "POST", url: INVITATIONS_URL, headers: bearer(role), payload: body as object });
  }

  it("invites for an ADMIN with the verified actor and returns the invitation result", async () => {
    const invite = vi.fn().mockResolvedValue({
      ok: true,
      value: { userId: USER_ID, email: INVITED_EMAIL, status: "invited" }
    });

    const response = await post(invite, { email: INVITED_EMAIL });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: USER_ID, email: INVITED_EMAIL, status: "invited" });
    expect(invite).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        email: INVITED_EMAIL,
        actorUserId: ADMIN_ID,
        correlationId: expect.any(String)
      })
    );
  });

  it.each([
    [{}],
    [{ email: "nope" }],
    [{ email: INVITED_EMAIL, actorUserId: ADMIN_ID }],
    [{ email: INVITED_EMAIL, role: "ADMIN" }],
    [null]
  ])("answers 400 for a malformed body (%o) without calling the use case", async (body) => {
    const invite = vi.fn();

    const response = await post(invite, body);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(invite).not.toHaveBeenCalled();
  });

  it("answers 401 without a token", async () => {
    const invite = vi.fn();
    app = mutationsApp({ invite });

    const response = await app.inject({ method: "POST", url: INVITATIONS_URL, payload: { email: INVITED_EMAIL } });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
    expect(invite).not.toHaveBeenCalled();
  });

  it.each(["PYME", "INVERSOR"] as const)("rejects %s with 403 before the use case", async (role) => {
    const invite = vi.fn();

    const response = await post(invite, { email: INVITED_EMAIL }, role);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
    expect(invite).not.toHaveBeenCalled();
  });

  it.each([
    ["email_exists", 409],
    ["unavailable", 503]
  ] as const)("maps the use-case code %s to %i", async (code, status) => {
    const invite = vi.fn().mockResolvedValue({ ok: false, error: { code } });

    const response = await post(invite, { email: INVITED_EMAIL });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ code });
  });

  it("maps a thrown dependency to a sanitized 503 that never echoes the error", async () => {
    const invite = vi.fn().mockRejectedValue(new Error("secret detail"));

    const response = await post(invite, { email: INVITED_EMAIL });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
    expect(response.body).not.toMatch(/secret/);
  });
});

describe("POST /admin/invitations/accept", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  async function post(
    acceptInvitation: AdminUsersRouteDependencies["acceptInvitation"],
    body: unknown,
    role: "ADMIN" | "PYME" | "INVERSOR" = "INVERSOR"
  ) {
    app = mutationsApp({ acceptInvitation });
    return app.inject({ method: "POST", url: ACCEPT_URL, headers: bearer(role), payload: body as object });
  }

  it("accepts for the authenticated invitee and passes the verified actor, never a body identity", async () => {
    const acceptInvitation = vi.fn().mockResolvedValue({
      ok: true,
      value: { userId: USER_ID, displayName: "Ana Operadora" }
    });

    const response = await post(acceptInvitation, { displayName: "Ana Operadora" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: USER_ID, displayName: "Ana Operadora" });
    expect(acceptInvitation).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        displayName: "Ana Operadora",
        actorUserId: principalFor("INVERSOR").userId,
        correlationId: expect.any(String)
      })
    );
  });

  it("is AUTHENTICATED: a PYME and an ADMIN reach it exactly like an investor", async () => {
    for (const role of ["PYME", "INVERSOR", "ADMIN"] as const) {
      const acceptInvitation = vi.fn().mockResolvedValue({
        ok: true,
        value: { userId: USER_ID, displayName: "Ana" }
      });

      const response = await post(acceptInvitation, { displayName: "Ana" }, role);
      await app?.close();
      app = undefined;

      expect(response.statusCode).toBe(200);
      expect(acceptInvitation).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ actorUserId: principalFor(role).userId })
      );
    }
  });

  it.each([
    [{}],
    [{ displayName: "" }],
    [{ displayName: "   " }],
    [{ displayName: "Ana", actorUserId: USER_ID }],
    [{ displayName: "Ana", password: "secret-123" }],
    [null]
  ])("answers 400 for a malformed body (%o) without calling the use case", async (body) => {
    const acceptInvitation = vi.fn();

    const response = await post(acceptInvitation, body);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("answers 401 without a token", async () => {
    const acceptInvitation = vi.fn();
    app = mutationsApp({ acceptInvitation });

    const response = await app.inject({ method: "POST", url: ACCEPT_URL, payload: { displayName: "Ana" } });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404],
    ["unavailable", 503]
  ] as const)("maps the use-case code %s to %i", async (code, status) => {
    const acceptInvitation = vi.fn().mockResolvedValue({ ok: false, error: { code } });

    const response = await post(acceptInvitation, { displayName: "Ana" });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ code });
  });

  it("maps a thrown dependency to a sanitized 503 that never echoes the error", async () => {
    const acceptInvitation = vi.fn().mockRejectedValue(new Error("secret detail"));

    const response = await post(acceptInvitation, { displayName: "Ana" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
    expect(response.body).not.toMatch(/secret/);
  });
});

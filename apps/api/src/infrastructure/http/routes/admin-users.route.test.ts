import { parseAdminUsersPage } from "@vaqcrow/contracts";
import type { AdminUsersPage } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminUsersReaderPort } from "../../../application/ports/admin-users-reader-port.js";
import { buildApp } from "../build-app.js";
import { bearer, fakeAuthPort, principalFor } from "../test-support/auth.js";
import {
  createAdminUsersRouteDependencies,
  parseAdminUsersQueryParams
} from "./admin-users.route.js";

const URL = "/admin/users";
const ADMIN_ID = principalFor("ADMIN").userId;

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
    adminUsers: createAdminUsersRouteDependencies({ list }),
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

import { parseAuditLogPage } from "@vaqcrow/contracts";
import type { AuditLogPage } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditLogReaderPort } from "../../../application/ports/audit-log-reader-port.js";
import { buildApp } from "../build-app.js";
import { bearer, fakeAuthPort } from "../test-support/auth.js";
import {
  createAdminAuditLogRouteDependencies,
  parseAuditLogQueryParams
} from "./admin-audit-log.route.js";

const URL = "/admin/audit-log";

const PAGE: AuditLogPage = parseAuditLogPage({
  items: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      occurredAt: "2026-10-12T13:00:00.000Z",
      actorUserId: "00000000-0000-4000-8000-000000000005",
      actorDisplayName: "Admin Vaqcrow",
      action: "admin.operator_invited",
      targetType: "operator",
      targetId: "new-op@vaqcrow.com",
      summary: "admin.operator_invited · operator"
    }
  ],
  total: 1,
  page: 1,
  pageSize: 20
});

function appFor(list: AuditLogReaderPort["list"]): FastifyInstance {
  return buildApp({
    adminAuditLog: createAdminAuditLogRouteDependencies({ list }),
    auth: { port: fakeAuthPort() }
  });
}

describe("parseAuditLogQueryParams", () => {
  it("defaults page and pageSize and validates the optional search", () => {
    expect(parseAuditLogQueryParams({})).toEqual({ page: 1, pageSize: 20 });
    expect(parseAuditLogQueryParams({ search: "invited", page: "3", pageSize: "50" })).toEqual({
      search: "invited",
      page: 3,
      pageSize: 50
    });
  });

  it.each([
    { pageSize: "101" },
    { pageSize: "0" },
    { page: "0" },
    { page: "abc" },
    { sort: "created_at" },
    { search: "" }
  ])("rejects malformed query %o", (query) => {
    expect(parseAuditLogQueryParams(query)).toBeUndefined();
  });
});

describe("GET /admin/audit-log", () => {
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
    expect(parseAuditLogPage(response.json())).toEqual(PAGE);
    expect(list).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 20 });
  });

  it("passes search and pagination through to the reader", async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, value: PAGE });
    app = appFor(list);

    await app.inject({ method: "GET", url: `${URL}?search=invited&page=2&pageSize=50`, headers: bearer("ADMIN") });

    expect(list).toHaveBeenCalledExactlyOnceWith({ search: "invited", page: 2, pageSize: 50 });
  });

  it.each(["pageSize=101", "page=0", "page=abc", "sort=created_at"])(
    "answers 400 for a malformed query (%s) without touching the reader",
    async (query) => {
      const list = vi.fn();
      app = appFor(list);

      const response = await app.inject({ method: "GET", url: `${URL}?${query}`, headers: bearer("ADMIN") });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ code: "invalid_request" });
      expect(list).not.toHaveBeenCalled();
    }
  );

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

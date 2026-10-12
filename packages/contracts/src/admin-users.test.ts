import { describe, expect, it } from "vitest";
import {
  adminUserSchema,
  adminUsersQuerySchema,
  auditLogPageSchema,
  changeUserRoleCommandSchema,
  inviteOperatorCommandSchema,
  parseAdminUsersQuery,
  parseChangeUserRoleCommand,
  parseInviteOperatorCommand,
  parseSetUserActiveCommand,
  setUserActiveCommandSchema
} from "./index.js";

/**
 * Admin › Usuarios (Feature #390). These tests fix the wire shape: the role
 * change never targets `ADMIN`, an invitation takes only an email, and every
 * schema is strict so a drifted response is an error.
 */
const USER = {
  userId: "00000000-0000-4000-8000-000000000001",
  displayName: "M. Pereyra",
  email: "m.pereyra@vaqcrow.com",
  role: "ADMIN",
  status: "active",
  lastActivityAt: "2026-10-12T13:00:00.000Z",
  kycStatus: "not_applicable",
  isSelf: true
};

describe("adminUserSchema", () => {
  it("parses a user row", () => {
    expect(adminUserSchema.parse(USER)).toEqual(USER);
  });

  it("accepts a null last activity (never a fabricated date)", () => {
    expect(adminUserSchema.safeParse({ ...USER, lastActivityAt: null }).success).toBe(true);
  });

  it("is strict: an unknown key is an error", () => {
    expect(adminUserSchema.safeParse({ ...USER, seed: "leak" }).success).toBe(false);
  });

  it("rejects an unknown role", () => {
    expect(adminUserSchema.safeParse({ ...USER, role: "SUPERADMIN" }).success).toBe(false);
  });
});

describe("adminUsersQuerySchema", () => {
  it("parses a minimal page query", () => {
    expect(parseAdminUsersQuery({ page: 1, pageSize: 20 })).toEqual({ page: 1, pageSize: 20 });
  });

  it("accepts optional search, role and status", () => {
    const parsed = parseAdminUsersQuery({
      page: 2,
      pageSize: 50,
      search: "pereyra",
      role: "INVERSOR",
      status: "invited"
    });
    expect(parsed.search).toBe("pereyra");
    expect(parsed.role).toBe("INVERSOR");
    expect(parsed.status).toBe("invited");
  });

  it("rejects a page size over 100", () => {
    expect(adminUsersQuerySchema.safeParse({ page: 1, pageSize: 101 }).success).toBe(false);
  });

  it("rejects a page below 1", () => {
    expect(adminUsersQuerySchema.safeParse({ page: 0, pageSize: 20 }).success).toBe(false);
  });

  it("is strict: an unknown key is an error", () => {
    expect(adminUsersQuerySchema.safeParse({ page: 1, pageSize: 20, sort: "name" }).success).toBe(
      false
    );
  });
});

describe("changeUserRoleCommandSchema", () => {
  it("accepts PYME and INVERSOR", () => {
    expect(parseChangeUserRoleCommand({ role: "PYME" }).role).toBe("PYME");
    expect(parseChangeUserRoleCommand({ role: "INVERSOR" }).role).toBe("INVERSOR");
  });

  it("rejects ADMIN: only the invitation grants it", () => {
    expect(changeUserRoleCommandSchema.safeParse({ role: "ADMIN" }).success).toBe(false);
  });
});

describe("setUserActiveCommandSchema", () => {
  it("requires a boolean", () => {
    expect(parseSetUserActiveCommand({ active: false })).toEqual({ active: false });
    expect(setUserActiveCommandSchema.safeParse({ active: "no" }).success).toBe(false);
  });
});

describe("inviteOperatorCommandSchema", () => {
  it("accepts a valid email", () => {
    expect(parseInviteOperatorCommand({ email: "op@vaqcrow.com" }).email).toBe("op@vaqcrow.com");
  });

  it("rejects an invalid email", () => {
    expect(inviteOperatorCommandSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("is strict: an unknown key is an error", () => {
    expect(inviteOperatorCommandSchema.safeParse({ email: "op@vaqcrow.com", role: "ADMIN" }).success).toBe(
      false
    );
  });
});

describe("auditLogPageSchema", () => {
  it("is strict and shapes a paginated audit log", () => {
    const page = { items: [], total: 0, page: 1, pageSize: 50 };
    expect(auditLogPageSchema.safeParse(page).success).toBe(true);
    expect(auditLogPageSchema.safeParse({ ...page, cursor: "x" }).success).toBe(false);
  });
});

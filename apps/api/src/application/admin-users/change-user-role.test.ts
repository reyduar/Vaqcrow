import { describe, expect, it, vi } from "vitest";
import type { AuditLogPort } from "../ports/audit-log-port.js";
import type { AdminUserWriterPort } from "../ports/admin-user-writer-port.js";
import { changeUserRole } from "./change-user-role.js";

/**
 * The role-change use case (#390/WU3a). The change is limited to PYME ↔
 * INVERSOR, an ADMIN target is refused, and an unchanged request is a conflict.
 * A successful change appends exactly one audit entry carrying `{ from, to }`.
 */

const TARGET = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const CORRELATION = "33333333-3333-4333-8333-333333333333";

function writer(role: "PYME" | "INVERSOR" | "ADMIN", overrides: Partial<AdminUserWriterPort> = {}): AdminUserWriterPort {
  return {
    findProfile: vi.fn().mockResolvedValue({ ok: true, value: { userId: TARGET, role, status: "active" } }),
    countActiveAdmins: vi.fn().mockResolvedValue({ ok: true, value: 3 }),
    setActive: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    setRole: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides
  };
}

function audit(overrides: Partial<AuditLogPort> = {}): AuditLogPort {
  return { append: vi.fn().mockResolvedValue({ ok: true, value: undefined }), ...overrides };
}

const request = (role: "PYME" | "INVERSOR") => ({
  targetUserId: TARGET,
  role,
  actorUserId: ACTOR,
  correlationId: CORRELATION
});

describe("changeUserRole", () => {
  it("promotes PYME to INVERSOR and audits admin.user_role_changed with from/to", async () => {
    const users = writer("PYME");
    const log = audit();

    const result = await changeUserRole({ users, audit: log }, request("INVERSOR"));

    expect(result).toEqual({ ok: true, value: { userId: TARGET, role: "INVERSOR" } });
    expect(users.setRole).toHaveBeenCalledExactlyOnceWith(TARGET, "INVERSOR");
    expect(log.append).toHaveBeenCalledExactlyOnceWith({
      actorUserId: ACTOR,
      action: "admin.user_role_changed",
      targetType: "user",
      targetId: TARGET,
      detail: { from: "PYME", to: "INVERSOR" },
      correlationId: CORRELATION
    });
  });

  it("demotes INVERSOR to PYME", async () => {
    const users = writer("INVERSOR");
    const log = audit();

    const result = await changeUserRole({ users, audit: log }, request("PYME"));

    expect(result).toEqual({ ok: true, value: { userId: TARGET, role: "PYME" } });
    expect(users.setRole).toHaveBeenCalledExactlyOnceWith(TARGET, "PYME");
    expect(log.append).toHaveBeenCalledOnce();
  });

  it("refuses an ADMIN target with `target_is_admin`, writing nothing", async () => {
    const users = writer("ADMIN");
    const log = audit();

    const result = await changeUserRole({ users, audit: log }, request("INVERSOR"));

    expect(result).toEqual({ ok: false, error: { code: "target_is_admin" } });
    expect(users.setRole).not.toHaveBeenCalled();
    expect(log.append).not.toHaveBeenCalled();
  });

  it("refuses an unchanged role with `unchanged`, writing nothing", async () => {
    const users = writer("PYME");
    const log = audit();

    const result = await changeUserRole({ users, audit: log }, request("PYME"));

    expect(result).toEqual({ ok: false, error: { code: "unchanged" } });
    expect(users.setRole).not.toHaveBeenCalled();
    expect(log.append).not.toHaveBeenCalled();
  });

  it("answers not_found for an unknown profile, writing nothing", async () => {
    const users = writer("PYME", { findProfile: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) });
    const log = audit();

    const result = await changeUserRole({ users, audit: log }, request("INVERSOR"));

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(users.setRole).not.toHaveBeenCalled();
    expect(log.append).not.toHaveBeenCalled();
  });

  it.each([
    ["a failed profile read", () => writer("PYME", { findProfile: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) }), audit()],
    ["a failed write", () => writer("PYME", { setRole: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) }), audit()],
    ["a failed audit append", () => writer("PYME"), audit({ append: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) })]
  ])("stays sanitized (unavailable) on %s", async (_label, factory, log) => {
    const result = await changeUserRole({ users: factory(), audit: log }, request("INVERSOR"));

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a thrown port to unavailable, never leaking the cause", async () => {
    const users = writer("PYME", { setRole: vi.fn().mockRejectedValue(new Error("SECRET provider detail")) });

    const result = await changeUserRole({ users, audit: audit() }, request("INVERSOR"));

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});

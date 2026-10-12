import { describe, expect, it, vi } from "vitest";
import type { AuditLogPort } from "../ports/audit-log-port.js";
import type { AdminUserWriterPort } from "../ports/admin-user-writer-port.js";
import { setUserActivation } from "./set-user-activation.js";

/**
 * The activation/deactivation use case (#390/WU3a). Only deactivation is
 * guarded, by the domain rule `canDeactivateUser`; activation is a plain write.
 * Every successful write appends exactly one audit entry attributed to the
 * verified principal, and a guard rejection writes nothing.
 */

const TARGET = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const CORRELATION = "33333333-3333-4333-8333-333333333333";

function writer(overrides: Partial<AdminUserWriterPort> = {}): AdminUserWriterPort {
  return {
    findProfile: vi.fn().mockResolvedValue({
      ok: true,
      value: { userId: TARGET, role: "PYME", status: "active" }
    }),
    countActiveAdmins: vi.fn().mockResolvedValue({ ok: true, value: 3 }),
    setActive: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    setRole: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides
  };
}

function audit(overrides: Partial<AuditLogPort> = {}): AuditLogPort {
  return { append: vi.fn().mockResolvedValue({ ok: true, value: undefined }), ...overrides };
}

const request = (active: boolean) => ({ targetUserId: TARGET, active, actorUserId: ACTOR, correlationId: CORRELATION });

describe("setUserActivation", () => {
  it("activates without the deactivation guard and audits admin.user_activated", async () => {
    const users = writer({
      findProfile: vi.fn().mockResolvedValue({ ok: true, value: { userId: TARGET, role: "PYME", status: "inactive" } })
    });
    const log = audit();

    const result = await setUserActivation({ users, audit: log }, request(true));

    expect(result).toEqual({ ok: true, value: { userId: TARGET, active: true } });
    expect(users.setActive).toHaveBeenCalledExactlyOnceWith(TARGET, true);
    expect(users.countActiveAdmins).not.toHaveBeenCalled();
    expect(log.append).toHaveBeenCalledExactlyOnceWith({
      actorUserId: ACTOR,
      action: "admin.user_activated",
      targetType: "user",
      targetId: TARGET,
      correlationId: CORRELATION
    });
  });

  it("deactivates an active non-self user after reading the active-admin count", async () => {
    const users = writer();
    const log = audit();

    const result = await setUserActivation({ users, audit: log }, request(false));

    expect(result).toEqual({ ok: true, value: { userId: TARGET, active: false } });
    expect(users.countActiveAdmins).toHaveBeenCalledOnce();
    expect(users.setActive).toHaveBeenCalledExactlyOnceWith(TARGET, false);
    expect(log.append).toHaveBeenCalledExactlyOnceWith({
      actorUserId: ACTOR,
      action: "admin.user_deactivated",
      targetType: "user",
      targetId: TARGET,
      correlationId: CORRELATION
    });
  });

  it("rejects deactivating yourself with `self`, writing nothing", async () => {
    const users = writer();
    const log = audit();

    const result = await setUserActivation(
      { users, audit: log },
      { ...request(false), actorUserId: TARGET }
    );

    expect(result).toEqual({ ok: false, error: { code: "self" } });
    expect(users.setActive).not.toHaveBeenCalled();
    expect(log.append).not.toHaveBeenCalled();
  });

  it("protects the last active admin with `last_admin`, writing nothing", async () => {
    const users = writer({
      findProfile: vi.fn().mockResolvedValue({ ok: true, value: { userId: TARGET, role: "ADMIN", status: "active" } }),
      countActiveAdmins: vi.fn().mockResolvedValue({ ok: true, value: 1 })
    });
    const log = audit();

    const result = await setUserActivation({ users, audit: log }, request(false));

    expect(result).toEqual({ ok: false, error: { code: "last_admin" } });
    expect(users.setActive).not.toHaveBeenCalled();
    expect(log.append).not.toHaveBeenCalled();
  });

  it("rejects deactivating an already-inactive account with `already_inactive`", async () => {
    const users = writer({
      findProfile: vi.fn().mockResolvedValue({ ok: true, value: { userId: TARGET, role: "PYME", status: "inactive" } })
    });

    const result = await setUserActivation({ users, audit: audit() }, request(false));

    expect(result).toEqual({ ok: false, error: { code: "already_inactive" } });
    expect(users.setActive).not.toHaveBeenCalled();
  });

  it("answers not_found for an unknown profile, writing nothing", async () => {
    const users = writer({ findProfile: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) });
    const log = audit();

    const result = await setUserActivation({ users, audit: log }, request(false));

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(users.setActive).not.toHaveBeenCalled();
    expect(log.append).not.toHaveBeenCalled();
  });

  it.each([
    ["a failed profile read", () => writer({ findProfile: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) })],
    ["a failed admin count", () => writer({ countActiveAdmins: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) })],
    ["a failed write", () => writer({ setActive: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) })],
    ["a failed audit append", () => writer()]
  ])("stays sanitized (unavailable) on %s", async (_label, factory) => {
    const isAuditFailure = _label === "a failed audit append";
    const users = factory();
    const log = audit(
      isAuditFailure ? { append: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) } : {}
    );

    const result = await setUserActivation({ users, audit: log }, request(false));

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a thrown port to unavailable", async () => {
    const users = writer({
      findProfile: vi.fn().mockRejectedValue(new Error("SECRET provider detail"))
    });

    const result = await setUserActivation({ users, audit: audit() }, request(false));

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});

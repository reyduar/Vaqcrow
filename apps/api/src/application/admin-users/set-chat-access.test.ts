import { describe, expect, it, vi } from "vitest";
import type { AuditLogPort } from "../ports/audit-log-port.js";
import type { AdminChatAccessWriterPort } from "../ports/admin-user-writer-port.js";
import { setChatAccess } from "./set-chat-access.js";

/**
 * The admin chat-access toggle use case (#499/WU2, D9). The flag is off by
 * default; toggling writes `profile.chat_enabled` and appends exactly one audit
 * entry attributed to the verified principal. A write matching no row is
 * `not_found`; a failed audit append makes the whole operation `unavailable`.
 */
const TARGET = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const CORRELATION = "33333333-3333-4333-8333-333333333333";

function writer(overrides: Partial<AdminChatAccessWriterPort> = {}): AdminChatAccessWriterPort {
  return { setChatAccess: vi.fn().mockResolvedValue({ ok: true, value: undefined }), ...overrides };
}

function audit(overrides: Partial<AuditLogPort> = {}): AuditLogPort {
  return { append: vi.fn().mockResolvedValue({ ok: true, value: undefined }), ...overrides };
}

const request = (enabled: boolean) => ({
  targetUserId: TARGET,
  enabled,
  actorUserId: ACTOR,
  correlationId: CORRELATION
});

describe("setChatAccess", () => {
  it("enables access and audits with the verified actor", async () => {
    const users = writer();
    const log = audit();

    const result = await setChatAccess({ users, audit: log }, request(true));

    expect(result).toEqual({ ok: true, value: { userId: TARGET, enabled: true } });
    expect(users.setChatAccess).toHaveBeenCalledExactlyOnceWith(TARGET, true);
    expect(log.append).toHaveBeenCalledExactlyOnceWith({
      actorUserId: ACTOR,
      action: "admin.chat_access_changed",
      targetType: "user",
      targetId: TARGET,
      detail: { enabled: true },
      correlationId: CORRELATION
    });
  });

  it("disables access too", async () => {
    const result = await setChatAccess({ users: writer(), audit: audit() }, request(false));
    expect(result).toEqual({ ok: true, value: { userId: TARGET, enabled: false } });
  });

  it("answers not_found for an unknown user, writing no audit entry", async () => {
    const log = audit();
    const result = await setChatAccess(
      { users: writer({ setChatAccess: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) }), audit: log },
      request(true)
    );
    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(log.append).not.toHaveBeenCalled();
  });

  it("answers unavailable when the audit append fails", async () => {
    const result = await setChatAccess(
      { users: writer(), audit: audit({ append: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) }) },
      request(true)
    );
    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("never lets a thrown provider error escape", async () => {
    const result = await setChatAccess(
      { users: writer({ setChatAccess: vi.fn().mockRejectedValue(new Error("secret")) }), audit: audit() },
      request(true)
    );
    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

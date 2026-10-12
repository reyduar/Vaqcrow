import { describe, expect, it, vi } from "vitest";
import type { AuditLogPort } from "../ports/audit-log-port.js";
import type { OperatorProfileWriterPort } from "../ports/operator-profile-writer-port.js";
import { acceptOperatorInvitation } from "./accept-operator-invitation.js";

/**
 * The invitation-acceptance use case (#390/WU5). The invitee updates their own
 * profile's `display_name` and exactly one audit entry
 * (`admin.operator_invitation_accepted`) is appended, attributed to the verified
 * principal, never to request data. The write targets the caller's own id; a
 * missing profile is `not_found`, any provider failure is a sanitized
 * `unavailable`, and a thrown dependency never leaks its cause.
 */

const ACTOR = "22222222-2222-4222-8222-222222222222";
const CORRELATION = "33333333-3333-4333-8333-333333333333";
const DISPLAY_NAME = "Ana Operadora";

function profile(overrides: Partial<OperatorProfileWriterPort> = {}): OperatorProfileWriterPort {
  return {
    setDisplayName: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides
  };
}

function audit(overrides: Partial<AuditLogPort> = {}): AuditLogPort {
  return { append: vi.fn().mockResolvedValue({ ok: true, value: undefined }), ...overrides };
}

const request = () => ({ displayName: DISPLAY_NAME, actorUserId: ACTOR, correlationId: CORRELATION });

describe("acceptOperatorInvitation", () => {
  it("sets the caller's own display name and audits admin.operator_invitation_accepted", async () => {
    const writer = profile();
    const log = audit();

    const result = await acceptOperatorInvitation({ profile: writer, audit: log }, request());

    expect(result).toEqual({ ok: true, value: { userId: ACTOR, displayName: DISPLAY_NAME } });
    expect(writer.setDisplayName).toHaveBeenCalledExactlyOnceWith(ACTOR, DISPLAY_NAME);
    expect(log.append).toHaveBeenCalledExactlyOnceWith({
      actorUserId: ACTOR,
      action: "admin.operator_invitation_accepted",
      targetType: "user",
      targetId: ACTOR,
      correlationId: CORRELATION
    });
  });

  it("omits correlationId from the audit entry when the request has none", async () => {
    const log = audit();

    await acceptOperatorInvitation({ profile: profile(), audit: log }, { displayName: DISPLAY_NAME, actorUserId: ACTOR });

    expect(log.append).toHaveBeenCalledExactlyOnceWith({
      actorUserId: ACTOR,
      action: "admin.operator_invitation_accepted",
      targetType: "user",
      targetId: ACTOR
    });
  });

  it("reports `not_found` and writes no audit entry when the profile is gone", async () => {
    const writer = profile({ setDisplayName: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) });
    const log = audit();

    const result = await acceptOperatorInvitation({ profile: writer, audit: log }, request());

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(log.append).not.toHaveBeenCalled();
  });

  it("stays sanitized (unavailable) when the profile write fails", async () => {
    const writer = profile({ setDisplayName: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    const log = audit();

    const result = await acceptOperatorInvitation({ profile: writer, audit: log }, request());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(log.append).not.toHaveBeenCalled();
  });

  it("is unavailable when the audit append fails", async () => {
    const log = audit({ append: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });

    const result = await acceptOperatorInvitation({ profile: profile(), audit: log }, request());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a thrown writer to unavailable, never leaking the cause", async () => {
    const writer = profile({ setDisplayName: vi.fn().mockRejectedValue(new Error("SECRET provider detail")) });

    const result = await acceptOperatorInvitation({ profile: writer, audit: audit() }, request());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});

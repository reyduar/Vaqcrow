import { describe, expect, it, vi } from "vitest";
import type { AuditLogPort } from "../ports/audit-log-port.js";
import type { NotificationPublisherPort, PublishSummary } from "../ports/notification-publisher-port.js";
import type { OperatorInviterPort } from "../ports/operator-inviter-port.js";
import { inviteOperator } from "./invite-operator.js";

/**
 * The operator-invitation use case (#390/WU3b). A successful invite appends
 * exactly one audit entry (`admin.operator_invited`, targeting the new user)
 * and publishes the in-app event best-effort: a throwing publisher must never
 * fail the invitation. An address that already has an account is `email_exists`
 * (a conflict); any provider failure is a sanitized `unavailable`.
 */

const EMAIL = "operador@vaqcrow.com";
const NEW_USER = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const CORRELATION = "33333333-3333-4333-8333-333333333333";

const SUMMARY: PublishSummary = {
  recipients: 1,
  inserted: 1,
  skipped: 0,
  emailsSent: 0,
  emailsFailed: 0,
  failed: false
};

function inviter(overrides: Partial<OperatorInviterPort> = {}): OperatorInviterPort {
  return {
    invite: vi.fn().mockResolvedValue({ ok: true, value: { userId: NEW_USER } }),
    ...overrides
  };
}

function audit(overrides: Partial<AuditLogPort> = {}): AuditLogPort {
  return { append: vi.fn().mockResolvedValue({ ok: true, value: undefined }), ...overrides };
}

function publisher(overrides: Partial<NotificationPublisherPort> = {}): NotificationPublisherPort {
  return { publish: vi.fn().mockResolvedValue(SUMMARY), ...overrides };
}

const request = () => ({ email: EMAIL, actorUserId: ACTOR, correlationId: CORRELATION });

describe("inviteOperator", () => {
  it("invites the email, audits admin.operator_invited and publishes the event", async () => {
    const port = inviter();
    const log = audit();
    const notifications = publisher();

    const result = await inviteOperator({ inviter: port, audit: log, notifications }, request());

    expect(result).toEqual({ ok: true, value: { userId: NEW_USER, email: EMAIL, status: "invited" } });
    expect(port.invite).toHaveBeenCalledExactlyOnceWith({ email: EMAIL });
    expect(log.append).toHaveBeenCalledExactlyOnceWith({
      actorUserId: ACTOR,
      action: "admin.operator_invited",
      targetType: "user",
      targetId: NEW_USER,
      correlationId: CORRELATION
    });
    expect(notifications.publish).toHaveBeenCalledExactlyOnceWith({
      eventKey: `operator:${NEW_USER}:invited`,
      type: "admin.operator_invited"
    });
  });

  it("omits correlationId from the audit entry when the request has none", async () => {
    const port = inviter();
    const log = audit();

    await inviteOperator({ inviter: port, audit: log, notifications: publisher() }, { email: EMAIL, actorUserId: ACTOR });

    expect(log.append).toHaveBeenCalledExactlyOnceWith({
      actorUserId: ACTOR,
      action: "admin.operator_invited",
      targetType: "user",
      targetId: NEW_USER
    });
  });

  it("reports `email_exists` for an address already registered, writing nothing", async () => {
    const port = inviter({ invite: vi.fn().mockResolvedValue({ ok: false, error: { code: "email_exists" } }) });
    const log = audit();
    const notifications = publisher();

    const result = await inviteOperator({ inviter: port, audit: log, notifications }, request());

    expect(result).toEqual({ ok: false, error: { code: "email_exists" } });
    expect(log.append).not.toHaveBeenCalled();
    expect(notifications.publish).not.toHaveBeenCalled();
  });

  it("stays sanitized (unavailable) when the provider is unavailable, writing nothing", async () => {
    const port = inviter({ invite: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    const log = audit();

    const result = await inviteOperator({ inviter: port, audit: log, notifications: publisher() }, request());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(log.append).not.toHaveBeenCalled();
  });

  it("is unavailable when the audit append fails, and does not publish", async () => {
    const log = audit({ append: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    const notifications = publisher();

    const result = await inviteOperator({ inviter: inviter(), audit: log, notifications }, request());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(notifications.publish).not.toHaveBeenCalled();
  });

  it("succeeds even when the notification publisher throws (best-effort delivery)", async () => {
    const notifications = publisher({ publish: vi.fn().mockRejectedValue(new Error("publisher down")) });

    const result = await inviteOperator({ inviter: inviter(), audit: audit(), notifications }, request());

    expect(result).toEqual({ ok: true, value: { userId: NEW_USER, email: EMAIL, status: "invited" } });
  });

  it("succeeds even when the notification publisher throws synchronously", async () => {
    const notifications = publisher({
      publish: vi.fn().mockImplementation(() => {
        throw new Error("sync throw");
      })
    });

    const result = await inviteOperator({ inviter: inviter(), audit: audit(), notifications }, request());

    expect(result).toEqual({ ok: true, value: { userId: NEW_USER, email: EMAIL, status: "invited" } });
  });

  it("maps a thrown inviter to unavailable, never leaking the cause", async () => {
    const port = inviter({ invite: vi.fn().mockRejectedValue(new Error("SECRET provider detail")) });

    const result = await inviteOperator({ inviter: port, audit: audit(), notifications: publisher() }, request());

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});

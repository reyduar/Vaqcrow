import type { InviteOperatorResult } from "@vaqcrow/contracts";
import type { AuditLogPort } from "../ports/audit-log-port.js";
import type { NotificationPublisherPort } from "../ports/notification-publisher-port.js";
import type { OperatorInviterPort } from "../ports/operator-inviter-port.js";

/**
 * Invite an operator by email (Feature #390, WU3b).
 *
 * `ADMIN` is only obtained through this invitation, never self-assigned. The
 * inviter port creates the account and promotes it to an active `ADMIN`; on
 * success exactly one append-only audit entry (`admin.operator_invited`) is
 * written, attributed to the verified principal, never to request data.
 *
 * The audit append is part of the completed operation: if it fails the whole
 * invitation is reported `unavailable` (the same rule the activation and
 * role-change use cases apply). The in-app `admin.operator_invited`
 * notification is best-effort — a throwing publisher must never fail the
 * invitation.
 */

export interface InviteOperatorDependencies {
  readonly inviter: OperatorInviterPort;
  readonly audit: AuditLogPort;
  readonly notifications: Pick<NotificationPublisherPort, "publish">;
}

export interface InviteOperatorRequest {
  readonly email: string;
  /** The verified principal's user id; never a client-supplied value. */
  readonly actorUserId: string;
  readonly correlationId?: string;
}

export type InviteOperatorErrorCode = "email_exists" | "unavailable";

export type InviteOperatorOutcome =
  | { readonly ok: true; readonly value: InviteOperatorResult }
  | { readonly ok: false; readonly error: { readonly code: InviteOperatorErrorCode } };

const EMAIL_EXISTS: InviteOperatorOutcome = { ok: false, error: { code: "email_exists" } };
const UNAVAILABLE: InviteOperatorOutcome = { ok: false, error: { code: "unavailable" } };

export async function inviteOperator(
  dependencies: InviteOperatorDependencies,
  input: InviteOperatorRequest
): Promise<InviteOperatorOutcome> {
  try {
    const invited = await dependencies.inviter.invite({ email: input.email });
    if (!invited.ok) {
      return invited.error.code === "email_exists" ? EMAIL_EXISTS : UNAVAILABLE;
    }
    const { userId } = invited.value;

    const audited = await dependencies.audit.append({
      actorUserId: input.actorUserId,
      action: "admin.operator_invited",
      targetType: "user",
      targetId: userId,
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId })
    });
    if (!audited.ok) return UNAVAILABLE;

    await publishOperatorInvited(dependencies.notifications, userId);

    return { ok: true, value: { userId, email: input.email, status: "invited" } };
  } catch {
    return UNAVAILABLE;
  }
}

/**
 * Raises the admin "operator invited" event, best-effort: neither a rejected
 * nor a synchronously-throwing publisher may fail the invitation, which is
 * already complete once the audit entry is written. The event key targets the
 * new user, so a retry is idempotent on the same account.
 */
async function publishOperatorInvited(
  notifications: Pick<NotificationPublisherPort, "publish">,
  userId: string
): Promise<void> {
  try {
    await notifications.publish({
      eventKey: `operator:${userId}:invited`,
      type: "admin.operator_invited"
    });
  } catch {
    // Delivery is best-effort by contract; the invitation already succeeded.
  }
}

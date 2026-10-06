import type {
  ApplicationReviewState,
  CorrelationId,
  HumanDecisionCommand,
  HumanDecisionRecord
} from "@vaqcrow/contracts";
import type { ApplicationReviewRepositoryPort } from "../ports/application-review-repository-port.js";
import type {
  NotificationEvent,
  NotificationPublisherPort
} from "../ports/notification-publisher-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";

export type RecordHumanDecisionError =
  | { readonly code: "not_found" | "idempotency_conflict" | "unavailable" }
  | { readonly code: "state_conflict"; readonly actualState: ApplicationReviewState };

export type RecordHumanDecisionResult =
  | {
      readonly ok: true;
      readonly value: { readonly decision: HumanDecisionRecord; readonly applied: boolean };
    }
  | { readonly ok: false; readonly error: RecordHumanDecisionError };

/**
 * The collaborators a decision needs to notify the application's owner: the
 * SME request repository resolves the owner from the application, and the
 * publisher delivers the in-app row and email. Both are optional so a caller
 * that does not notify (a read, an older test) keeps the original signature.
 */
export interface DecisionNotificationDependencies {
  readonly smeRequests: Pick<SmeRequestRepositoryPort, "findByApplicationId">;
  readonly notifications: Pick<NotificationPublisherPort, "publish">;
}

export async function recordHumanDecision(
  repository: ApplicationReviewRepositoryPort,
  input: { readonly command: HumanDecisionCommand; readonly correlationId: CorrelationId },
  notification?: DecisionNotificationDependencies
): Promise<RecordHumanDecisionResult> {
  const result = await repository.recordHumanDecision(input);

  if (result.ok) {
    const value = { decision: result.value.record, applied: result.value.applied };

    // Only a real apply notifies, and never the `approved` outcome: its
    // notification belongs to the deployment/publish states unit (D3). A
    // missing or failing collaborator must never fail the decision.
    if (value.applied && notification !== undefined) {
      await notifyDecisionOutcome(notification, value.decision);
    }

    return { ok: true, value };
  }

  if (result.error.code === "state_conflict") {
    return result.error.actualState === undefined
      ? { ok: false, error: { code: "unavailable" } }
      : {
          ok: false,
          error: { code: "state_conflict", actualState: result.error.actualState }
        };
  }

  if (
    result.error.code === "not_found" ||
    result.error.code === "idempotency_conflict" ||
    result.error.code === "unavailable"
  ) {
    return { ok: false, error: { code: result.error.code } };
  }

  return { ok: false, error: { code: "unavailable" } };
}

/**
 * Notifies the application's owner of a changes-requested or rejected decision,
 * best-effort: an unresolved owner, an unavailable lookup or a throwing
 * publisher are all swallowed. An unresolved owner skips the send rather than
 * falling back to a role-wide broadcast, and the event key carries the decision
 * id so a retried publish is idempotent at the row level.
 */
async function notifyDecisionOutcome(
  notification: DecisionNotificationDependencies,
  decision: HumanDecisionRecord
): Promise<void> {
  if (decision.outcome === "approved") {
    return;
  }

  let ownerUserId: string | undefined;
  try {
    const owner = await notification.smeRequests.findByApplicationId(decision.applicationId);
    if (!owner.ok) {
      return;
    }
    ownerUserId = owner.value.ownerUserId;
  } catch {
    return;
  }

  if (ownerUserId === undefined) {
    return;
  }

  const eventKey = `application:${decision.applicationId}:decision:${decision.decisionId}:${decision.outcome}`;
  const event: NotificationEvent =
    decision.outcome === "changes_requested"
      ? { eventKey, type: "pyme.changes_requested", recipientUserIds: [ownerUserId] }
      : { eventKey, type: "pyme.rejected", recipientUserIds: [ownerUserId] };

  try {
    await notification.notifications.publish(event);
  } catch {
    // Delivery is best-effort by contract; the decision is already recorded.
  }
}

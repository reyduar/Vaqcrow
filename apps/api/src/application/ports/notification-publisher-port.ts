import type {
  NotificationEventType,
  NotificationPayload
} from "../notifications/notification-catalogue.js";

/**
 * The port Features call to raise a notification (Feature #382, Task #383 /
 * T1b-1). The publisher use case and its Supabase/Resend adapters land in
 * T1b-2; this file is only the contract.
 *
 * Publishing is best-effort from the caller's perspective: a delivery failure
 * must never fail the action that raised the event, so an implementation
 * reports what it did in a `PublishSummary` rather than throwing. The event
 * key is the idempotency anchor for a retry.
 */

export interface NotificationEvent {
  /** Stable identifier of the event instance, e.g. `application:<uuid>:submitted`. */
  readonly eventKey: string;
  readonly type: NotificationEventType;
  /** Discriminated by its own `type`, which must agree with `type` above. */
  readonly payload: NotificationPayload;
}

export interface PublishSummary {
  readonly inserted: number;
  readonly skipped: number;
  readonly emailsSent: number;
  readonly emailsFailed: number;
}

export interface NotificationPublisherPort {
  publish(event: NotificationEvent): Promise<PublishSummary>;
}

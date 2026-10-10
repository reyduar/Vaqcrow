import type { NotificationPayload } from "../notifications/notification-catalogue.js";

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

/**
 * The event and its payload are one object: the discriminant `type` is derived
 * from `NotificationPayload`, so the event type can never disagree with the
 * payload's. The catalogue renders directly from the event (`renderInApp(event)`),
 * and a mismatched pair is now unrepresentable rather than a runtime check.
 */
export type NotificationEvent = {
  /** Stable identifier of the event instance, e.g. `application:<uuid>:submitted`. */
  readonly eventKey: string;
  /**
   * When present, the event is delivered to exactly these users and the role
   * directory is never consulted. When absent, the event is addressed by the
   * catalogue's `NOTIFICATION_AUDIENCE` role, unchanged. This is how a `pyme.*`
   * event reaches the application's owner instead of every PyME.
   */
  readonly recipientUserIds?: readonly string[];
} & NotificationPayload;

export interface PublishSummary {
  /** How many recipients the audience resolved to (0 when the lookup failed). */
  readonly recipients: number;
  readonly inserted: number;
  readonly skipped: number;
  readonly emailsSent: number;
  readonly emailsFailed: number;
  /**
   * True when the run could not do its persistence work: the recipient lookup
   * was unavailable or an in-app insert failed. A failed *email* is counted in
   * `emailsFailed` and never sets this flag — delivery is best-effort by design.
   */
  readonly failed: boolean;
}

export interface NotificationPublisherPort {
  publish(event: NotificationEvent): Promise<PublishSummary>;
}

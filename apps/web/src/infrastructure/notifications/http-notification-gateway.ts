import axios, { type AxiosInstance } from "axios";
import {
  NOTIFICATION_ERROR_CODES,
  type NotificationCountResult,
  type NotificationErrorCode,
  type NotificationItem,
  type NotificationListResult,
  type NotificationMarkAllResult,
  type NotificationMarkReadResult,
  type NotificationPort
} from "@/application/ports/notification-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the in-app notification bell (Feature #382, Task #383 / T1d).
 *
 * It talks to the four routes of `notification.route.ts` with the signed-in
 * session's `Authorization: Bearer` token: `GET /notifications`,
 * `GET /notifications/unread-count`, `POST /notifications/:id/read` and
 * `POST /notifications/read-all`. The recipient is resolved by the API from
 * that token, so this adapter never sends one.
 *
 * Failures are the sanitized code the API sends, a status-derived code, or
 * `network` when the transport itself fails — provider messages and response
 * bodies never cross this boundary. A dedicated axios client is used (like the
 * company and upload adapters) so a malformed success body collapses to
 * `unavailable` instead of throwing.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

function isNotificationErrorCode(value: unknown): value is NotificationErrorCode {
  return typeof value === "string" && (NOTIFICATION_ERROR_CODES as readonly string[]).includes(value);
}

/** The identifier-shaped `code` of the API's `{ code }` envelope, or `undefined`. */
function codeFromEnvelope(data: unknown): NotificationErrorCode | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  if ("code" in data) {
    const code = (data as { code: unknown }).code;
    if (isNotificationErrorCode(code)) return code;
  }
  // The mark-read branch answers `{ error: "not_found" }`, not `{ code }`.
  if ("error" in data) {
    const error = (data as { error: unknown }).error;
    if (isNotificationErrorCode(error)) return error;
  }
  return undefined;
}

function codeForStatus(status: number, data: unknown): NotificationErrorCode {
  const envelope = codeFromEnvelope(data);
  if (envelope) return envelope;
  if (status === 404) return "not_found";
  return "unavailable";
}

async function headersFor(provider: AccessTokenProvider | undefined): Promise<Record<string, string>> {
  if (!provider) return {};
  let token: string | null;
  try {
    token = await provider();
  } catch {
    return {};
  }
  return typeof token === "string" && BEARER_TOKEN_PATTERN.test(token) ? { Authorization: `Bearer ${token}` } : {};
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/** Narrows one list entry; anything malformed is `undefined` (the whole list then fails). */
function parseItem(data: unknown): NotificationItem | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { id, recipientUserId, eventKey, eventType, title, body, ctaLabel, ctaHref, readAt, createdAt } =
    data as Record<string, unknown>;

  if (typeof id !== "string" || id.length === 0) return undefined;
  if (typeof recipientUserId !== "string") return undefined;
  if (typeof eventKey !== "string" || typeof eventType !== "string") return undefined;
  if (typeof title !== "string" || typeof body !== "string") return undefined;
  if (!isNullableString(ctaLabel) || !isNullableString(ctaHref)) return undefined;
  if (!isNullableString(readAt)) return undefined;
  if (typeof createdAt !== "string") return undefined;

  return { id, recipientUserId, eventKey, eventType, title, body, ctaLabel, ctaHref, readAt, createdAt };
}

function parseList(data: unknown): readonly NotificationItem[] | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const candidate = (data as { notifications?: unknown }).notifications;
  if (!Array.isArray(candidate)) return undefined;

  const items: NotificationItem[] = [];
  for (const entry of candidate) {
    const item = parseItem(entry);
    if (!item) return undefined;
    items.push(item);
  }
  return items;
}

/** The `{ unread }` envelope; a non-negative integer is the only valid shape. */
function parseUnread(data: unknown): number | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const unread = (data as { unread?: unknown }).unread;
  return typeof unread === "number" && Number.isInteger(unread) && unread >= 0 ? unread : undefined;
}

/** The `{ updated }` envelope; a non-negative integer is the only valid shape. */
function parseUpdated(data: unknown): number | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const updated = (data as { updated?: unknown }).updated;
  return typeof updated === "number" && Number.isInteger(updated) && updated >= 0 ? updated : undefined;
}

export class HttpNotificationGateway implements NotificationPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpNotificationGateway {
    return new HttpNotificationGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  async list(): Promise<NotificationListResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/notifications", { headers, validateStatus: () => true });
      if (response.status !== 200) return { ok: false, code: codeForStatus(response.status, response.data) };
      const notifications = parseList(response.data);
      return notifications ? { ok: true, notifications } : { ok: false, code: "unavailable" };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async countUnread(): Promise<NotificationCountResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/notifications/unread-count", { headers, validateStatus: () => true });
      if (response.status !== 200) return { ok: false, code: codeForStatus(response.status, response.data) };
      const unread = parseUnread(response.data);
      return unread !== undefined ? { ok: true, unread } : { ok: false, code: "unavailable" };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async markRead(id: string): Promise<NotificationMarkReadResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.post(`/notifications/${encodeURIComponent(id)}/read`, undefined, {
        headers,
        validateStatus: () => true
      });
      if (response.status === 200) return { ok: true };
      return { ok: false, code: codeForStatus(response.status, response.data) };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async markAllRead(): Promise<NotificationMarkAllResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.post("/notifications/read-all", undefined, {
        headers,
        validateStatus: () => true
      });
      if (response.status !== 200) return { ok: false, code: codeForStatus(response.status, response.data) };
      const updated = parseUpdated(response.data);
      return updated !== undefined ? { ok: true, updated } : { ok: false, code: "unavailable" };
    } catch {
      return { ok: false, code: "network" };
    }
  }
}

import type { NotificationPort } from "@/application/ports/notification-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpNotificationGateway } from "./http-notification-gateway";
import { UNAVAILABLE_NOTIFICATION_PORT } from "./unavailable-notification-port";

export { UNAVAILABLE_NOTIFICATION_PORT };

/**
 * Builds the notification port from the API base URL and, when given, the
 * session's access token. `null` when no backend is configured: the bell then
 * runs on `UNAVAILABLE_NOTIFICATION_PORT` and shows nothing.
 */
export function createNotificationPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): NotificationPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpNotificationGateway.create(trimmed, accessToken);
}

/**
 * The browser default used by the header. It reuses the app's existing browser
 * auth wiring to attach the session's `Authorization: Bearer` token, following
 * the same lazy-session approach as `createBrowserBusinessPort` and
 * `createBrowserUploadPort` (the session store does not expose `getAccessToken`
 * to components today; a later unit should share the single session port).
 */
export function createBrowserNotificationPort(): NotificationPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_NOTIFICATION_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpNotificationGateway.create(baseUrl, () => session.getAccessToken());
}

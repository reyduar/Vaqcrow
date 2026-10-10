import type { AdminQueuePort } from "@/application/ports/admin-queue-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpAdminQueueGateway } from "./http-admin-queue-gateway";
import { UNAVAILABLE_ADMIN_QUEUE_PORT } from "./unavailable-admin-queue-port";

export { UNAVAILABLE_ADMIN_QUEUE_PORT };

/** Builds the queue port from the API base URL and an optional token provider; `null` without a backend. */
export function createAdminQueuePort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): AdminQueuePort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpAdminQueueGateway.create(trimmed, accessToken);
}

/**
 * Browser default. It reuses the app's lazy browser session to attach the
 * `Authorization: Bearer` token, like `createBrowserNotificationPort`; without
 * a configured base URL it is the null object so the queue stays honest.
 */
export function createBrowserAdminQueuePort(): AdminQueuePort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_ADMIN_QUEUE_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpAdminQueueGateway.create(baseUrl, () => session.getAccessToken());
}

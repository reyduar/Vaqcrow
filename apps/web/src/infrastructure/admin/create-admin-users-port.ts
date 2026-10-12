import type { AdminUsersPort } from "@/application/admin/users";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpAdminUsersGateway } from "./http-admin-users-gateway";
import { UNAVAILABLE_ADMIN_USERS_PORT } from "./unavailable-admin-users-port";

export { UNAVAILABLE_ADMIN_USERS_PORT };

/** Builds the users port from the API base URL and an optional token provider; `null` without a backend. */
export function createAdminUsersPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): AdminUsersPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpAdminUsersGateway.create(trimmed, accessToken);
}

/**
 * Browser default. It reuses the app's lazy browser session to attach the
 * `Authorization: Bearer` token, like `createBrowserAdminQueuePort`; without a
 * configured base URL it is the null object so the view stays honest.
 */
export function createBrowserAdminUsersPort(): AdminUsersPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_ADMIN_USERS_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpAdminUsersGateway.create(baseUrl, () => session.getAccessToken());
}

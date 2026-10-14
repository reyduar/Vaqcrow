import type { AssistantPort } from "@/application/assistant/assistant-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpAssistantGateway } from "./http-assistant-gateway";
import { UNAVAILABLE_ASSISTANT_PORT } from "./unavailable-assistant-port";

export { UNAVAILABLE_ASSISTANT_PORT };

/** Builds the assistant port from the API base URL and an optional token provider; `null` without a backend. */
export function createAssistantPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): AssistantPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpAssistantGateway.create(trimmed, accessToken);
}

/**
 * Browser default. It reuses the app's lazy browser session to attach the
 * `Authorization: Bearer` token, like `createBrowserAdminUsersPort`; without a
 * configured base URL it is the null object so the chat stays honest.
 */
export function createBrowserAssistantPort(): AssistantPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_ASSISTANT_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpAssistantGateway.create(baseUrl, () => session.getAccessToken());
}

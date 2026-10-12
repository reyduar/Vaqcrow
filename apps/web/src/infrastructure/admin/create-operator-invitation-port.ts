import type {
  OperatorInvitationPort,
  OperatorInvitationResult
} from "@/application/ports/operator-invitation-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpOperatorInvitationGateway } from "./http-operator-invitation-gateway";

/**
 * Null object used when no API base URL is configured: the acceptance reports
 * the sanitized `unavailable`, so the screen shows its error state instead of a
 * silently-swallowed write.
 */
export const UNAVAILABLE_OPERATOR_INVITATION_PORT: OperatorInvitationPort = Object.freeze({
  async accept(): Promise<OperatorInvitationResult> {
    return { ok: false, code: "unavailable" };
  }
});

/** Builds the port from the API base URL and an optional token provider; `null` without a backend. */
export function createOperatorInvitationPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): OperatorInvitationPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpOperatorInvitationGateway.create(trimmed, accessToken);
}

/**
 * Browser default. It reuses the app's lazy browser session to attach the
 * `Authorization: Bearer` token, like the other admin gateways; without a
 * configured base URL it is the null object so the screen stays honest.
 */
export function createBrowserOperatorInvitationPort(): OperatorInvitationPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_OPERATOR_INVITATION_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpOperatorInvitationGateway.create(baseUrl, () => session.getAccessToken());
}

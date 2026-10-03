import type { UploadPort } from "@/application/ports/upload-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpUploadAdapter } from "./http-upload-adapter";
import { UNAVAILABLE_UPLOAD_PORT } from "./unavailable-upload-port";

export { UNAVAILABLE_UPLOAD_PORT };

/**
 * Builds the upload port from the API base URL and, when given, the session's
 * access token. `null` when no backend is configured: the UI then renders with
 * `UNAVAILABLE_UPLOAD_PORT` and refuses to act.
 */
export function createUploadPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): UploadPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpUploadAdapter.create(trimmed, accessToken);
}

/**
 * The browser default used by `/company`. It reuses the app's existing browser
 * auth wiring to attach the session's `Authorization: Bearer` token.
 *
 * It builds its own lazy session because the session store does not expose
 * `getAccessToken` to components today (it is created per provider mount in
 * `state/`, outside this task's surface). A later unit should share the single
 * session port and this lazy duplicate should go; until then it is built on the
 * first upload and only when a backend is configured.
 */
export function createBrowserUploadPort(): UploadPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_UPLOAD_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpUploadAdapter.create(baseUrl, () => session.getAccessToken());
}

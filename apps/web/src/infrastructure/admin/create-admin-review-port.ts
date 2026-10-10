import type { AdminEvidencePort, AdminReviewPort } from "@/application/ports/admin-review-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import { HttpAdminReviewGateway } from "./http-admin-review-gateway";
import { UNAVAILABLE_ADMIN_REVIEW_PORT } from "./unavailable-admin-review-port";

export { UNAVAILABLE_ADMIN_REVIEW_PORT };

/**
 * Browser default. It reuses the app's lazy browser session to attach the
 * `Authorization: Bearer` token, like `createBrowserAdminQueuePort`; without a
 * configured base URL it is the null object so the review stays honest.
 */
export function createBrowserAdminReviewPort(): AdminReviewPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_ADMIN_REVIEW_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpAdminReviewGateway.create(baseUrl, () => session.getAccessToken());
}

/** Browser default for the evidence view (#438 WU4): the same gateway, typed by its evidence capability. */
export function createBrowserAdminEvidencePort(): AdminEvidencePort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_ADMIN_REVIEW_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpAdminReviewGateway.create(baseUrl, () => session.getAccessToken());
}

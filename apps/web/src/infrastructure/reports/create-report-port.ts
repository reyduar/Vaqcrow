import type { ReportPort, ReportSalesPort } from "@/application/ports/report-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpReportGateway } from "./http-report-gateway";
import { HttpReportSalesGateway } from "./http-report-sales-gateway";
import { UNAVAILABLE_REPORT_PORT, UNAVAILABLE_REPORT_SALES_PORT } from "./unavailable-report-ports";

export { UNAVAILABLE_REPORT_PORT, UNAVAILABLE_REPORT_SALES_PORT };

/** Builds the report port from the API base URL; `null` without a backend. */
export function createReportPort(baseUrl: string | undefined, accessToken?: AccessTokenProvider): ReportPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpReportGateway.create(trimmed, accessToken);
}

/** Builds the sales-by-PyME port from the API base URL; `null` without a backend. */
export function createReportSalesPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): ReportSalesPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpReportSalesGateway.create(trimmed, accessToken);
}

/**
 * Browser defaults. Both reads are available to every authenticated role and
 * reuse the app's lazy browser session to attach the `Authorization: Bearer`
 * token; without a configured base URL they are the null objects so the page
 * stays honest.
 */
export function createBrowserReportPort(): ReportPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_REPORT_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpReportGateway.create(baseUrl, () => session.getAccessToken());
}

export function createBrowserReportSalesPort(): ReportSalesPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_REPORT_SALES_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpReportSalesGateway.create(baseUrl, () => session.getAccessToken());
}

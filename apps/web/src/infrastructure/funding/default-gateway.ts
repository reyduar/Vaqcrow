import type { FundingIntentGateway } from "@/application/ports/funding-intent-gateway";
import { AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { HttpFundingIntentGateway } from "./http-funding-intent-gateway";

/** `null` when no backend is configured: the UI then refuses to sign and says so. */
export function createFundingIntentGateway(baseUrl: string | undefined): FundingIntentGateway | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return new HttpFundingIntentGateway(AxiosHttpClient.create({ baseUrl: trimmed }));
}

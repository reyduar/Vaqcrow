import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import { AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { HttpCampaignGateway } from "./http-campaign-gateway";

/** `null` when no backend is configured: the UI then refuses to act and says so. */
export function createCampaignGateway(baseUrl: string | undefined): CampaignGateway | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return new HttpCampaignGateway(AxiosHttpClient.create({ baseUrl: trimmed }));
}

import type { HumanDecisionGateway } from "@/application/ports/human-decision-gateway";
import { AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { HttpHumanDecisionGateway } from "./http-human-decision-gateway";

/** `null` when no backend is configured: the UI then refuses to record and says so. */
export function createHumanDecisionGateway(baseUrl: string | undefined): HumanDecisionGateway | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return new HttpHumanDecisionGateway(AxiosHttpClient.create({ baseUrl: trimmed }));
}

import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { HttpSmeRequestGateway } from "./http-sme-request-gateway";

/** `null` when no backend is configured: callers then run on synthetic fixtures only. */
export function createSmeRequestGateway(baseUrl: string | undefined): SmeRequestGateway | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return new HttpSmeRequestGateway(AxiosHttpClient.create({ baseUrl: trimmed }));
}

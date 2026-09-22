import type { AssessmentGateway } from "@/application/ports/assessment-gateway";
import { AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { HttpAssessmentGateway } from "./http-assessment-gateway";

/** `null` when no backend is configured: the UI then says so instead of pretending. */
export function createAssessmentGateway(baseUrl: string | undefined): AssessmentGateway | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return new HttpAssessmentGateway(AxiosHttpClient.create({ baseUrl: trimmed }));
}

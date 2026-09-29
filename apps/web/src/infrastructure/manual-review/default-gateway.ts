import type { ManualReviewGateway } from "@/application/ports/manual-review-gateway";
import { AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { HttpManualReviewGateway } from "./http-manual-review-gateway";

/** `null` when no backend is configured: the screen then shows its unrelated-flow copy. */
export function createManualReviewGateway(baseUrl: string | undefined): ManualReviewGateway | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return new HttpManualReviewGateway(AxiosHttpClient.create({ baseUrl: trimmed }));
}

import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { AssessmentView } from "@/application/assessment/assessment-view";
import type { AssessmentGateway } from "@/application/ports/assessment-gateway";
import { HttpClientError } from "@/application/ports/http-client-port";
import { usePersistedAssessment } from "./use-persisted-assessment";

/**
 * `absent` is the backend's truthful 404; an outage is `unavailable` and never
 * collapses into `absent`, so the approval step cannot tell a reviewer "there is
 * no assessment" when the read merely failed.
 */

const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

const VIEW: AssessmentView = {
  assessmentId: "asm_demo_001",
  riskBand: "medium",
  confidence: 0.72,
  reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
  anomalies: [],
  missingData: [],
  recommendedAction: "human_review",
  questions: [],
  provenance: { model: "m", promptVersion: "p", generatedAt: "2026-09-22T12:00:00.000Z", source: "simulated" }
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

const gatewayLoading = (load: AssessmentGateway["load"]): AssessmentGateway => ({ assess: vi.fn(), load });

describe("usePersistedAssessment", () => {
  it("is absent without a gateway and never fetches", () => {
    const { result } = renderHook(() => usePersistedAssessment(null, APPLICATION_ID), { wrapper });

    expect(result.current).toEqual({ status: "absent" });
  });

  it("loads the persisted assessment of the application", async () => {
    const load = vi.fn().mockResolvedValue(VIEW);
    const { result } = renderHook(() => usePersistedAssessment(gatewayLoading(load), APPLICATION_ID), { wrapper });

    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current).toEqual({ status: "present", view: VIEW }));
    expect(load).toHaveBeenCalledWith(APPLICATION_ID);
  });

  it("is absent when the backend has none recorded", async () => {
    const { result } = renderHook(
      () => usePersistedAssessment(gatewayLoading(vi.fn().mockResolvedValue(null)), APPLICATION_ID),
      { wrapper }
    );

    await waitFor(() => expect(result.current).toEqual({ status: "absent" }));
  });

  it("is unavailable, not absent, when the read fails", async () => {
    const load = vi.fn().mockRejectedValue(new HttpClientError("http", 503, undefined, "unavailable"));
    const { result } = renderHook(() => usePersistedAssessment(gatewayLoading(load), APPLICATION_ID), { wrapper });

    await waitFor(() => expect(result.current).toEqual({ status: "unavailable" }));
  });
});

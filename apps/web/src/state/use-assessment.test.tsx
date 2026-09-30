import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentView } from "@/application/assessment/assessment-view";
import type { AssessmentGateway, AssessmentOutcome } from "@/application/ports/assessment-gateway";
import { HttpClientError } from "@/application/ports/http-client-port";
import { useAssessment } from "./use-assessment";

/**
 * One user-initiated attempt = one handoff id. The id survives a failure whose
 * outcome is unknown (the backend may have recorded it), so the retry replays
 * instead of colliding with its own earlier record; it is dropped once the
 * backend gave a definitive answer.
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
  provenance: {
    model: "glm-5.3-flash",
    promptVersion: "assessment-v1",
    generatedAt: "2026-09-22T12:00:00.000Z",
    source: "provider"
  }
};

function idSequence(): () => string {
  let n = 0;
  return () => `00000000-0000-4000-8000-00000000000${++n}`;
}

function gatewayOf(assess: AssessmentGateway["assess"]): AssessmentGateway {
  return { assess, load: vi.fn() };
}

describe("useAssessment", () => {
  // A stable generator: a fresh one per render would restart the sequence.
  let generateId = idSequence();
  beforeEach(() => {
    generateId = idSequence();
  });

  it("does nothing and reports the missing application when the journey has none", async () => {
    const assess = vi.fn();
    const { result } = renderHook(() => useAssessment(gatewayOf(assess), null, generateId));

    await act(() => result.current.request());

    expect(assess).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ status: "failed", code: "no_application" });
  });

  it("fails explicitly when no backend is configured", async () => {
    const { result } = renderHook(() => useAssessment(null, APPLICATION_ID, generateId));

    await act(() => result.current.request());

    expect(result.current.state).toEqual({ status: "failed", code: "not_configured" });
  });

  it.each([
    ["a recorded assessment", { kind: "recorded", view: VIEW } as AssessmentOutcome, { status: "recorded", view: VIEW }],
    [
      "the manual-review routing",
      { kind: "manual_review", failureCode: "timeout" } as AssessmentOutcome,
      { status: "manual_review", failureCode: "timeout" }
    ],
    [
      "a missing sales series",
      { kind: "sales_evidence_missing" } as AssessmentOutcome,
      { status: "no_sales_evidence" }
    ]
  ])("maps %s to its own state", async (_label, outcome, expected) => {
    const assess = vi.fn().mockResolvedValue(outcome);
    const { result } = renderHook(() => useAssessment(gatewayOf(assess), APPLICATION_ID, generateId));

    await act(() => result.current.request());

    expect(result.current.state).toEqual(expected);
    expect(assess).toHaveBeenCalledWith(APPLICATION_ID, "00000000-0000-4000-8000-000000000001");
  });

  it("reuses the handoff id when retrying after an outage and drops it after a definitive answer", async () => {
    const assess = vi
      .fn<AssessmentGateway["assess"]>()
      .mockRejectedValueOnce(new HttpClientError("network"))
      .mockResolvedValueOnce({ kind: "recorded", view: VIEW })
      .mockResolvedValueOnce({ kind: "sales_evidence_missing" });
    const { result } = renderHook(() => useAssessment(gatewayOf(assess), APPLICATION_ID, generateId));

    await act(() => result.current.request());
    expect(result.current.state).toEqual({ status: "failed", code: "unavailable" });

    await act(() => result.current.request());
    expect(result.current.state.status).toBe("recorded");

    await act(() => result.current.request());

    const ids = assess.mock.calls.map((call) => call[1]);
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).not.toBe(ids[0]);
  });

  it("classifies backend failures by their own code and a drifted response separately", async () => {
    const assess = vi
      .fn<AssessmentGateway["assess"]>()
      .mockRejectedValueOnce(new HttpClientError("http", 404, undefined, "not_found"))
      .mockRejectedValueOnce(new HttpClientError("http", 409, undefined, "state_conflict"))
      .mockRejectedValueOnce(new TypeError("drifted"));
    const { result } = renderHook(() => useAssessment(gatewayOf(assess), APPLICATION_ID, generateId));

    await act(() => result.current.request());
    expect(result.current.state).toEqual({ status: "failed", code: "not_found" });
    await act(() => result.current.request());
    expect(result.current.state).toEqual({ status: "failed", code: "state_conflict" });
    await act(() => result.current.request());
    expect(result.current.state).toEqual({ status: "failed", code: "invalid_response" });
  });

  it("starts a fresh attempt id after a conflict the backend bound to the previous one", async () => {
    const assess = vi
      .fn<AssessmentGateway["assess"]>()
      .mockRejectedValueOnce(new HttpClientError("http", 409, undefined, "correlation_conflict"))
      .mockResolvedValueOnce({ kind: "recorded", view: VIEW });
    const { result } = renderHook(() => useAssessment(gatewayOf(assess), APPLICATION_ID, generateId));

    await act(() => result.current.request());
    await act(() => result.current.request());

    expect(assess.mock.calls[1]?.[1]).not.toBe(assess.mock.calls[0]?.[1]);
  });

  it("ignores a second request while one is in flight", async () => {
    let release: (outcome: AssessmentOutcome) => void = () => undefined;
    const assess = vi.fn().mockReturnValue(new Promise<AssessmentOutcome>((resolve) => (release = resolve)));
    const { result } = renderHook(() => useAssessment(gatewayOf(assess), APPLICATION_ID, generateId));

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.request();
    });
    await act(() => result.current.request());
    expect(result.current.state).toEqual({ status: "loading" });
    await act(async () => {
      release({ kind: "recorded", view: VIEW });
      await first;
    });

    expect(assess).toHaveBeenCalledTimes(1);
  });
});

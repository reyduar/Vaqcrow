import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationManualReviewContext } from "@vaqcrow/contracts";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { ManualReviewGateway } from "@/application/ports/manual-review-gateway";
import { useManualReviewContext } from "./use-manual-review-context";

/**
 * The hook must preserve the distinction the `ManualReviewGateway` port exists
 * to carry: `null` is the backend's truthful "no handoff" (a `404`), while a
 * rejection is "the context could not be requested". Collapsing both into
 * `absent` would let an outage be read as "there is no handoff".
 */

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as ApplicationManualReviewContext["applicationId"];

const CONTEXT: ApplicationManualReviewContext = {
  applicationId: APPLICATION_ID,
  applicationState: "human_review",
  failureCode: "timeout",
  evidence: {
    periods: [
      {
        period: "2026-01",
        amountArs: 1_200_000,
        status: "reported",
        evidenceRef: "sales:2026-01",
        simuladoLabel: "SIMULADO"
      }
    ],
    findings: []
  },
  recordedAt: "2026-09-28T12:05:00.000Z"
};

function gatewayResolving(value: Awaited<ReturnType<ManualReviewGateway["load"]>>): ManualReviewGateway {
  return { load: vi.fn().mockResolvedValue(value) };
}

function gatewayRejecting(error: unknown): ManualReviewGateway {
  return { load: vi.fn().mockRejectedValue(error) };
}

describe("useManualReviewContext", () => {
  it("exposes the persisted context once the gateway resolves it", async () => {
    const { result } = renderHook(() => useManualReviewContext(gatewayResolving(CONTEXT), APPLICATION_ID));

    await waitFor(() => expect(result.current).toEqual({ status: "present", context: CONTEXT }));
  });

  it("reports absent only for a truthful null: the backend says there is no handoff", async () => {
    const { result } = renderHook(() => useManualReviewContext(gatewayResolving(null), APPLICATION_ID));

    await waitFor(() => expect(result.current).toEqual({ status: "absent" }));
  });

  it.each([
    ["a 503 unavailable", new HttpClientError("http", 503, undefined, "unavailable")],
    ["a network failure", new HttpClientError("network")]
  ])(
    "reports unavailable, never absent, when the context could not be requested (%s)",
    async (_name, error) => {
      const { result } = renderHook(() => useManualReviewContext(gatewayRejecting(error), APPLICATION_ID));

      await waitFor(() => expect(result.current).toEqual({ status: "unavailable" }));
    }
  );

  it("reports unavailable when the response drifted out of contract rather than absent", async () => {
    const { result } = renderHook(() =>
      useManualReviewContext(gatewayRejecting(new Error("contract-parse")), APPLICATION_ID)
    );

    await waitFor(() => expect(result.current).toEqual({ status: "unavailable" }));
  });

  it("stays absent with no gateway: there is nothing to load and no context is invented", () => {
    const { result } = renderHook(() => useManualReviewContext(null, APPLICATION_ID));

    expect(result.current).toEqual({ status: "absent" });
  });
});

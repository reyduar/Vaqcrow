import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import type { AdminReviewContext, AdminReviewPort, AdminReviewResult } from "@/application/ports/admin-review-port";
import { useAdminReview } from "./use-admin-review";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";

const CONTEXT = {
  applicationId: APPLICATION_ID,
  state: "human_review",
  company: null,
  documents: [],
  documentVerdicts: [],
  assessment: null,
  latestHumanDecision: null
} as unknown as AdminReviewContext;

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function portOf(respond: () => AdminReviewResult) {
  const calls: string[] = [];
  const port: AdminReviewPort = {
    async getContext(applicationId) {
      calls.push(applicationId);
      return respond();
    }
  };
  return { port, calls };
}

describe("useAdminReview", () => {
  it("loads the context for the application id", async () => {
    const { port, calls } = portOf(() => ({ ok: true, context: CONTEXT }));
    const { result } = renderHook(() => useAdminReview(port, APPLICATION_ID), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.context).toEqual(CONTEXT));
    expect(result.current.errorCode).toBeNull();
    expect(calls).toEqual([APPLICATION_ID]);
  });

  it("surfaces the sanitized failure code and never a stale context", async () => {
    const { port } = portOf(() => ({ ok: false, code: "not_found" }));
    const { result } = renderHook(() => useAdminReview(port, APPLICATION_ID), { wrapper });

    await waitFor(() => expect(result.current.errorCode).toBe("not_found"));
    expect(result.current.context).toBeNull();
  });

  it("re-reads through the port on reload", async () => {
    let response: AdminReviewResult = { ok: false, code: "unavailable" };
    const { port, calls } = portOf(() => response);
    const { result } = renderHook(() => useAdminReview(port, APPLICATION_ID), { wrapper });
    await waitFor(() => expect(result.current.errorCode).toBe("unavailable"));

    response = { ok: true, context: CONTEXT };
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.context).toEqual(CONTEXT));
    expect(result.current.errorCode).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it("fetches nothing without a port", () => {
    const { result } = renderHook(() => useAdminReview(null, APPLICATION_ID), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.context).toBeNull();
    expect(result.current.errorCode).toBeNull();
  });
});

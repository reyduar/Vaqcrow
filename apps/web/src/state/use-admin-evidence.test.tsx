import { act, renderHook, waitFor } from "@testing-library/react";
import type { AdminApplicationEvidence } from "@vaqcrow/contracts";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import type { AdminEvidencePort, GetEvidenceResult } from "@/application/ports/admin-review-port";
import { useAdminEvidence } from "./use-admin-evidence";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222" as AdminApplicationEvidence["applicationId"];

const EVIDENCE: AdminApplicationEvidence = {
  applicationId: APPLICATION_ID,
  applicationState: "human_review",
  smeReference: "sme-001",
  companyName: null,
  decision: null,
  deployment: null,
  vault: null,
  contributions: [],
  distributions: [],
  reconciliation: null
};

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function portOf(respond: () => GetEvidenceResult) {
  const calls: string[] = [];
  const port: AdminEvidencePort = {
    async getEvidence(applicationId) {
      calls.push(applicationId);
      return respond();
    }
  };
  return { port, calls };
}

describe("useAdminEvidence", () => {
  it("loads the evidence for the application id", async () => {
    const { port, calls } = portOf(() => ({ ok: true, evidence: EVIDENCE }));
    const { result } = renderHook(() => useAdminEvidence(port, APPLICATION_ID), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.evidence).toEqual(EVIDENCE));
    expect(result.current.errorCode).toBeNull();
    expect(calls).toEqual([APPLICATION_ID]);
  });

  it("surfaces the sanitized failure code and never stale evidence", async () => {
    const { port } = portOf(() => ({ ok: false, code: "not_found" }));
    const { result } = renderHook(() => useAdminEvidence(port, APPLICATION_ID), { wrapper });

    await waitFor(() => expect(result.current.errorCode).toBe("not_found"));
    expect(result.current.evidence).toBeNull();
  });

  it("re-reads through the port on reload", async () => {
    let response: GetEvidenceResult = { ok: false, code: "unavailable" };
    const { port, calls } = portOf(() => response);
    const { result } = renderHook(() => useAdminEvidence(port, APPLICATION_ID), { wrapper });
    await waitFor(() => expect(result.current.errorCode).toBe("unavailable"));

    response = { ok: true, evidence: EVIDENCE };
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.evidence).toEqual(EVIDENCE));
    expect(result.current.errorCode).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it("maps an unexpected throw to unavailable", async () => {
    const port: AdminEvidencePort = {
      async getEvidence() {
        throw new Error("boom");
      }
    };
    const { result } = renderHook(() => useAdminEvidence(port, APPLICATION_ID), { wrapper });
    await waitFor(() => expect(result.current.errorCode).toBe("unavailable"));
  });

  it("fetches nothing without a port", () => {
    const { result } = renderHook(() => useAdminEvidence(null, APPLICATION_ID), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.evidence).toBeNull();
    expect(result.current.errorCode).toBeNull();
  });
});

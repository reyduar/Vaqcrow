import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type {
  AdminDeployment,
  AdminReviewPort,
  DeployResult,
  GetDeploymentResult
} from "@/application/ports/admin-review-port";
import { useAdminDeployment } from "./use-admin-deployment";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const POLL_MS = 10;

const BASE: AdminDeployment = {
  applicationId: APPLICATION_ID,
  state: "pending",
  attempts: 0,
  campaignId: null,
  lastError: null,
  retryable: false,
  createdAt: "2026-10-07T15:30:00.000Z",
  updatedAt: "2026-10-07T15:30:00.000Z"
};

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function portOf(reads: () => GetDeploymentResult, deploy: () => DeployResult | Promise<DeployResult> = () => ({ ok: false, code: "unavailable" })) {
  const calls = { get: 0, post: 0 };
  const port: AdminReviewPort = {
    async getContext() {
      return { ok: false, code: "unavailable" };
    },
    async setDocumentVerdict() {
      return { ok: false, code: "unavailable" };
    },
    async downloadDocument() {
      return { ok: false, code: "unavailable" };
    },
    async recordDecision() {
      return { ok: false, code: "unavailable" };
    },
    async getDeployment(applicationId) {
      expect(applicationId).toBe(APPLICATION_ID);
      calls.get += 1;
      return reads();
    },
    async deploy(applicationId) {
      expect(applicationId).toBe(APPLICATION_ID);
      calls.post += 1;
      return deploy();
    }
  };
  return { port, calls };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useAdminDeployment", () => {
  it("polls while pending/deploying and stops once confirmed", async () => {
    const sequence: AdminDeployment["state"][] = ["pending", "deploying", "confirmed"];
    let index = 0;
    const { port, calls } = portOf(() => {
      const state = sequence[Math.min(index, sequence.length - 1)]!;
      index += 1;
      return { ok: true, deployment: { ...BASE, state } };
    });
    const { result } = renderHook(
      () => useAdminDeployment(port, APPLICATION_ID, "approved", { reload: vi.fn(), pollIntervalMs: POLL_MS }),
      { wrapper }
    );

    await waitFor(() =>
      expect(result.current.read).toEqual({ kind: "record", deployment: { ...BASE, state: "confirmed" } })
    );
    const settled = calls.get;
    expect(settled).toBe(3);
    await act(() => pause(POLL_MS * 8));
    expect(calls.get).toBe(settled);
  });

  it("stops polling on a failed deployment", async () => {
    const { port, calls } = portOf(() => ({ ok: true, deployment: { ...BASE, state: "failed", lastError: "unavailable" } }));
    const { result } = renderHook(
      () => useAdminDeployment(port, APPLICATION_ID, "approved", { reload: vi.fn(), pollIntervalMs: POLL_MS }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.read?.kind).toBe("record"));
    await act(() => pause(POLL_MS * 8));
    expect(calls.get).toBe(1);
  });

  it("treats a 404 as a missing deployment and does not poll", async () => {
    const { port, calls } = portOf(() => ({ ok: false, code: "not_found" }));
    const { result } = renderHook(
      () => useAdminDeployment(port, APPLICATION_ID, "approved", { reload: vi.fn(), pollIntervalMs: POLL_MS }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.read).toEqual({ kind: "missing" }));
    expect(result.current.errorCode).toBeNull();
    await act(() => pause(POLL_MS * 8));
    expect(calls.get).toBe(1);
  });

  it("stops polling once unmounted", async () => {
    const { port, calls } = portOf(() => ({ ok: true, deployment: BASE }));
    const { result, unmount } = renderHook(
      () => useAdminDeployment(port, APPLICATION_ID, "approved", { reload: vi.fn(), pollIntervalMs: POLL_MS }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.read?.kind).toBe("record"));
    unmount();
    const atUnmount = calls.get;
    await pause(POLL_MS * 8);
    expect(calls.get).toBe(atUnmount);
  });

  it("surfaces a read failure without inventing a deployment", async () => {
    const { port } = portOf(() => ({ ok: false, code: "network" }));
    const { result } = renderHook(
      () => useAdminDeployment(port, APPLICATION_ID, "approved", { reload: vi.fn(), pollIntervalMs: POLL_MS }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.errorCode).toBe("network"));
    expect(result.current.read).toBeUndefined();
  });

  it("retries once while in flight, then revalidates the panel and the review", async () => {
    let state: AdminDeployment["state"] = "failed";
    let resolveDeploy: (value: DeployResult) => void = () => undefined;
    const { port, calls } = portOf(
      () => ({ ok: true, deployment: { ...BASE, state } }),
      () => new Promise<DeployResult>((resolve) => (resolveDeploy = resolve))
    );
    const reload = vi.fn();
    const { result } = renderHook(
      () => useAdminDeployment(port, APPLICATION_ID, "approved", { reload, pollIntervalMs: POLL_MS }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.read?.kind).toBe("record"));

    act(() => {
      void result.current.retry();
      void result.current.retry();
    });
    await waitFor(() => expect(result.current.retrying).toBe(true));
    expect(calls.post).toBe(1);

    state = "confirmed";
    await act(async () => resolveDeploy({ ok: true, deployment: { ...BASE, state: "confirmed" } }));

    await waitFor(() => expect(result.current.retrying).toBe(false));
    await waitFor(() =>
      expect(result.current.read).toEqual({ kind: "record", deployment: { ...BASE, state: "confirmed" } })
    );
    expect(result.current.message).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("keeps an honest message when the retry is refused", async () => {
    const { port } = portOf(
      () => ({ ok: true, deployment: { ...BASE, state: "failed", lastError: "wallet_required" } }),
      () => ({ ok: false, code: "wallet_required" })
    );
    const reload = vi.fn();
    const { result } = renderHook(
      () => useAdminDeployment(port, APPLICATION_ID, "approved", { reload, pollIntervalMs: POLL_MS }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.read?.kind).toBe("record"));
    await act(() => result.current.retry());
    expect(result.current.message).toMatch(/no se completó/);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("stops polling a stale deploying attempt the server reports as retryable (U8)", async () => {
    const { port, calls } = portOf(() => ({ ok: true, deployment: { ...BASE, state: "deploying", retryable: true } }));
    const { result } = renderHook(
      () => useAdminDeployment(port, APPLICATION_ID, "approved", { reload: vi.fn(), pollIntervalMs: POLL_MS }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.read?.kind).toBe("record"));
    const reads = calls.get;
    await act(() => pause(POLL_MS * 5));
    expect(calls.get).toBe(reads);
  });

  it("deploys from a missing read with the same single POST, then re-reads (U8)", async () => {
    let read: GetDeploymentResult = { ok: false, code: "not_found" };
    const confirmed: AdminDeployment = { ...BASE, state: "confirmed", attempts: 1, campaignId: "camp-1" };
    const { port, calls } = portOf(
      () => read,
      () => {
        read = { ok: true, deployment: confirmed };
        return { ok: true, deployment: confirmed };
      }
    );
    const reload = vi.fn();
    const { result } = renderHook(
      () => useAdminDeployment(port, APPLICATION_ID, "approved", { reload, pollIntervalMs: POLL_MS }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.read).toEqual({ kind: "missing" }));

    await act(() => result.current.retry());

    expect(calls.post).toBe(1);
    await waitFor(() => expect(result.current.read).toEqual({ kind: "record", deployment: confirmed }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("explains deployment_in_progress honestly and re-reads the panel (U8)", async () => {
    const { port, calls } = portOf(
      () => ({ ok: true, deployment: { ...BASE, state: "failed", retryable: true } }),
      () => ({ ok: false, code: "deployment_in_progress" })
    );
    const { result } = renderHook(
      () => useAdminDeployment(port, APPLICATION_ID, "approved", { reload: vi.fn(), pollIntervalMs: POLL_MS }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.read?.kind).toBe("record"));
    const reads = calls.get;

    await act(() => result.current.retry());

    expect(result.current.message).toMatch(/en curso/);
    expect(calls.get).toBeGreaterThan(reads);
  });

  it("fetches nothing without a port", () => {
    const { result } = renderHook(
      () => useAdminDeployment(null, APPLICATION_ID, "approved", { reload: vi.fn(), pollIntervalMs: POLL_MS }),
      { wrapper }
    );
    expect(result.current.read).toBeUndefined();
    expect(result.current.errorCode).toBeNull();
  });
});

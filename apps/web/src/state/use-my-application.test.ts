import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { useMyApplication } from "./use-my-application";

const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

function gateway(loadMine: SmeRequestGateway["loadMine"]): SmeRequestGateway {
  return { submit: vi.fn(), load: vi.fn(), loadMine };
}

/**
 * The owner-scoped read that drives `/company` after submission (Feature #530,
 * T3/S6). The hook can only tell apart "a resolved application" from "nothing
 * to act on"; it never fabricates one and never surfaces a service failure.
 */
describe("useMyApplication", () => {
  it("fetches nothing with a null gateway (no backend, #480)", async () => {
    const { result } = renderHook(() => useMyApplication(null, true), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBeUndefined();
  });

  it("fetches nothing while disabled", async () => {
    const loadMine = vi.fn().mockResolvedValue({ ok: true, application: null });
    const { result } = renderHook(() => useMyApplication(gateway(loadMine), false), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(loadMine).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  it("resolves the caller's own application, id and real state, from the owner-scoped read", async () => {
    const loadMine = vi
      .fn()
      .mockResolvedValue({ ok: true, application: { applicationId: APPLICATION_ID, state: "human_review" } });
    const { result } = renderHook(() => useMyApplication(gateway(loadMine), true), { wrapper });

    await waitFor(() => expect(result.current).not.toBeUndefined());
    expect(loadMine).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ applicationId: APPLICATION_ID, state: "human_review" });
  });

  it("stays undefined when the caller owns no application", async () => {
    const loadMine = vi.fn().mockResolvedValue({ ok: true, application: null });
    const { result } = renderHook(() => useMyApplication(gateway(loadMine), true), { wrapper });

    await waitFor(() => expect(loadMine).toHaveBeenCalledTimes(1));
    expect(result.current).toBeUndefined();
  });

  it("stays undefined on a failed read, never a fabricated application", async () => {
    const loadMine = vi.fn().mockResolvedValue({ ok: false, code: "unavailable" });
    const { result } = renderHook(() => useMyApplication(gateway(loadMine), true), { wrapper });

    await waitFor(() => expect(loadMine).toHaveBeenCalledTimes(1));
    expect(result.current).toBeUndefined();
  });

  it("stays undefined when the read rejects", async () => {
    const loadMine = vi.fn().mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useMyApplication(gateway(loadMine), true), { wrapper });

    await waitFor(() => expect(loadMine).toHaveBeenCalledTimes(1));
    expect(result.current).toBeUndefined();
  });
});

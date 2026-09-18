import { act, renderHook, waitFor } from "@testing-library/react";
import type { SmeRequest } from "@vaqcrow/contracts";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { useSmeRequest } from "./use-sme-request";

const VALUES = { declaredTotalArs: "100", periodStart: "2026-01", periodEnd: "2026-02" };
const REQUEST: SmeRequest = {
  smeReference: "sme:T",
  declaredTotalArs: 100,
  periodStart: "2026-01",
  periodEnd: "2026-02",
  simuladoLabel: "SIMULADO"
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

function gateway(overrides: Partial<SmeRequestGateway> = {}): SmeRequestGateway {
  return {
    submit: vi.fn().mockResolvedValue(REQUEST),
    loadCurrent: vi.fn().mockResolvedValue({ request: null, salesPeriods: [] }),
    ...overrides
  };
}

describe("useSmeRequest", () => {
  it("loads server state through the gateway", async () => {
    const gw = gateway({ loadCurrent: vi.fn().mockResolvedValue({ request: REQUEST, salesPeriods: [] }) });

    const { result } = renderHook(() => useSmeRequest(gw, "sme:T"), { wrapper });

    await waitFor(() => expect(result.current.current?.request).toEqual(REQUEST));
    expect(result.current.loadFailed).toBe(false);
  });

  it("reports a load failure without inventing data", async () => {
    const gw = gateway({ loadCurrent: vi.fn().mockRejectedValue(new HttpClientError("network")) });

    const { result } = renderHook(() => useSmeRequest(gw, "sme:T"), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.current).toBeUndefined();
  });

  it("does not touch the network when no gateway is configured, and submit never claims success", async () => {
    const { result } = renderHook(() => useSmeRequest(null, "sme:T"), { wrapper });

    await act(async () => {
      await result.current.submit(VALUES);
    });

    expect(result.current.submitted).toBe(false);
    expect(result.current.submitError?.message).toMatch(/no está disponible/);
    expect(result.current.loadFailed).toBe(false);
  });

  it("revalidates after a successful submit and marks it submitted", async () => {
    const gw = gateway();
    const { result } = renderHook(() => useSmeRequest(gw, "sme:T"), { wrapper });
    await waitFor(() => expect(gw.loadCurrent).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.submit(VALUES);
    });

    expect(gw.submit).toHaveBeenCalledWith(REQUEST);
    expect(result.current.submitted).toBe(true);
    expect(result.current.submitError).toBeUndefined();
    await waitFor(() => expect(gw.loadCurrent).toHaveBeenCalledTimes(2));
    expect(result.current.isSubmitting).toBe(false);
  });

  it("exposes sanitized field errors on rejection and never marks submitted", async () => {
    const gw = gateway({
      submit: vi.fn().mockRejectedValue(new HttpClientError("http", 422, { periodEnd: "before_start" }))
    });
    const { result } = renderHook(() => useSmeRequest(gw, "sme:T"), { wrapper });

    await act(async () => {
      await result.current.submit(VALUES);
    });

    expect(result.current.submitted).toBe(false);
    expect(result.current.submitError?.fieldErrors?.periodEnd).toMatch(/anterior/);
    expect(result.current.isSubmitting).toBe(false);
  });

  it("clears a previous error and success flag when submitting again", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new HttpClientError("http", 500))
      .mockResolvedValueOnce(REQUEST);
    const { result } = renderHook(() => useSmeRequest(gateway({ submit }), "sme:T"), { wrapper });

    await act(async () => {
      await result.current.submit(VALUES);
    });
    expect(result.current.submitError).toBeDefined();

    await act(async () => {
      await result.current.submit(VALUES);
    });
    expect(result.current.submitError).toBeUndefined();
    expect(result.current.submitted).toBe(true);
  });
});

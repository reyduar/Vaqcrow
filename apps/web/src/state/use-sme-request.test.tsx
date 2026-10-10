import { renderHook, waitFor } from "@testing-library/react";
import type { SmeRequest } from "@vaqcrow/contracts";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { useSmeRequestState } from "./use-sme-request";

const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const REQUEST: SmeRequest = {
  smeReference: "sme:T",
  declaredTotalArs: 100,
  periodStart: "2026-01",
  periodEnd: "2026-02",
  simuladoLabel: "SIMULADO"
};
const SAVED = { applicationId: APPLICATION_ID, request: REQUEST };

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

function gateway(overrides: Partial<SmeRequestGateway> = {}): SmeRequestGateway {
  return {
    submit: vi.fn().mockResolvedValue(SAVED),
    load: vi.fn().mockResolvedValue({ request: REQUEST, salesPeriods: [], state: "awaiting_assessment" }),
    ...overrides
  };
}

describe("useSmeRequestState", () => {
  it("does not fetch without a gateway or an applicationId", async () => {
    const gw = gateway();
    const { result } = renderHook(() => useSmeRequestState(gw, null), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(gw.load).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  it("reads the application's own state by id", async () => {
    const gw = gateway({
      load: vi.fn().mockResolvedValue({ request: REQUEST, salesPeriods: [], state: "changes_requested" })
    });
    const { result } = renderHook(() => useSmeRequestState(gw, APPLICATION_ID), { wrapper });

    await waitFor(() => expect(result.current).toBe("changes_requested"));
    expect(gw.load).toHaveBeenCalledWith(APPLICATION_ID);
  });

  it("stays undefined while the read is in flight or fails, never inventing a state", async () => {
    const gw = gateway({ load: vi.fn().mockRejectedValue(new HttpClientError("network")) });
    const { result } = renderHook(() => useSmeRequestState(gw, APPLICATION_ID), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBeUndefined();
  });
});

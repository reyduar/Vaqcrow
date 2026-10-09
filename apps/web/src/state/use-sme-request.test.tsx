import { act, renderHook, waitFor } from "@testing-library/react";
import type { SmeRequest } from "@vaqcrow/contracts";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { JourneyStoreProvider, useJourneyStore } from "./journey-store-provider";
import { useSmeRequest, useSmeRequestState } from "./use-sme-request";

const VALUES = { declaredTotalArs: "100", periodStart: "2026-01", periodEnd: "2026-02" };
const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const SECOND_APPLICATION_ID = "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const REQUEST: SmeRequest = {
  smeReference: "sme:T",
  declaredTotalArs: 100,
  periodStart: "2026-01",
  periodEnd: "2026-02",
  simuladoLabel: "SIMULADO"
};
const SAVED = { applicationId: APPLICATION_ID, request: REQUEST };

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <JourneyStoreProvider>{children}</JourneyStoreProvider>
  </SWRConfig>
);

function gateway(overrides: Partial<SmeRequestGateway> = {}): SmeRequestGateway {
  return {
    submit: vi.fn().mockResolvedValue(SAVED),
    load: vi.fn().mockResolvedValue({ request: REQUEST, salesPeriods: [], state: "awaiting_assessment" }),
    ...overrides
  };
}

/** Exposes the hook together with the journey store slice it writes to. */
function renderSme(gw: SmeRequestGateway | null) {
  return renderHook(
    () => ({
      sme: useSmeRequest(gw, "sme:T"),
      applicationId: useJourneyStore((state) => state.applicationId),
      recordApplication: useJourneyStore((state) => state.recordApplication)
    }),
    { wrapper }
  );
}

describe("useSmeRequest", () => {
  it("does not fetch while the journey has no applicationId", async () => {
    const gw = gateway();

    const { result } = renderSme(gw);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(gw.load).not.toHaveBeenCalled();
    expect(result.current.sme.current).toBeUndefined();
    expect(result.current.sme.loadFailed).toBe(false);
  });

  it("loads server state keyed by the store applicationId", async () => {
    const gw = gateway();
    const { result } = renderSme(gw);

    act(() => result.current.recordApplication(APPLICATION_ID));

    await waitFor(() => expect(result.current.sme.current?.request).toEqual(REQUEST));
    expect(gw.load).toHaveBeenCalledWith(APPLICATION_ID);
    expect(result.current.sme.loadFailed).toBe(false);
  });

  it("refetches when the store records a different application", async () => {
    const gw = gateway();
    const { result } = renderSme(gw);
    act(() => result.current.recordApplication(APPLICATION_ID));
    await waitFor(() => expect(gw.load).toHaveBeenCalledWith(APPLICATION_ID));

    act(() => result.current.recordApplication(SECOND_APPLICATION_ID));

    await waitFor(() => expect(gw.load).toHaveBeenCalledWith(SECOND_APPLICATION_ID));
  });

  it("reports a load failure without inventing data", async () => {
    const gw = gateway({ load: vi.fn().mockRejectedValue(new HttpClientError("network")) });
    const { result } = renderSme(gw);

    act(() => result.current.recordApplication(APPLICATION_ID));

    await waitFor(() => expect(result.current.sme.loadFailed).toBe(true));
    expect(result.current.sme.current).toBeUndefined();
  });

  it("does not touch the network when no gateway is configured, and submit never claims success", async () => {
    const { result } = renderSme(null);

    await act(async () => {
      await result.current.sme.submit(VALUES);
    });

    expect(result.current.sme.submitted).toBe(false);
    expect(result.current.sme.submitError?.message).toMatch(/no está disponible/);
    expect(result.current.sme.loadFailed).toBe(false);
    expect(result.current.applicationId).toBeNull();
  });

  it("records the returned applicationId in the journey store, then loads it", async () => {
    const gw = gateway();
    const { result } = renderSme(gw);

    await act(async () => {
      await result.current.sme.submit(VALUES);
    });

    expect(gw.submit).toHaveBeenCalledWith(REQUEST);
    expect(result.current.applicationId).toBe(APPLICATION_ID);
    expect(result.current.sme.submitted).toBe(true);
    expect(result.current.sme.submitError).toBeUndefined();
    await waitFor(() => expect(gw.load).toHaveBeenCalledWith(APPLICATION_ID));
    await waitFor(() => expect(result.current.sme.current?.request).toEqual(REQUEST));
    expect(result.current.sme.isSubmitting).toBe(false);
  });

  it("does not record an applicationId when the submit fails", async () => {
    const gw = gateway({ submit: vi.fn().mockRejectedValue(new HttpClientError("http", 503)) });
    const { result } = renderSme(gw);

    await act(async () => {
      await result.current.sme.submit(VALUES);
    });

    expect(result.current.applicationId).toBeNull();
    expect(result.current.sme.submitted).toBe(false);
  });

  it("exposes sanitized field errors on rejection and never marks submitted", async () => {
    const gw = gateway({
      submit: vi.fn().mockRejectedValue(new HttpClientError("http", 422, { periodEnd: "before_start" }))
    });
    const { result } = renderSme(gw);

    await act(async () => {
      await result.current.sme.submit(VALUES);
    });

    expect(result.current.sme.submitted).toBe(false);
    expect(result.current.sme.submitError?.fieldErrors?.periodEnd).toMatch(/anterior/);
    expect(result.current.sme.isSubmitting).toBe(false);
  });

  it("clears a previous error and success flag when submitting again", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new HttpClientError("http", 500))
      .mockResolvedValueOnce(SAVED);
    const { result } = renderSme(gateway({ submit }));

    await act(async () => {
      await result.current.sme.submit(VALUES);
    });
    expect(result.current.sme.submitError).toBeDefined();

    await act(async () => {
      await result.current.sme.submit(VALUES);
    });
    expect(result.current.sme.submitError).toBeUndefined();
    expect(result.current.sme.submitted).toBe(true);
  });

  it("ignores a second submit while one is in flight", async () => {
    let resolveSubmit: (value: typeof SAVED) => void = () => undefined;
    const submit = vi.fn().mockReturnValue(
      new Promise<typeof SAVED>((resolve) => {
        resolveSubmit = resolve;
      })
    );
    const { result } = renderSme(gateway({ submit }));

    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.sme.submit(VALUES);
      await result.current.sme.submit(VALUES);
    });

    expect(submit).toHaveBeenCalledTimes(1);
    expect(result.current.sme.isSubmitting).toBe(true);

    await act(async () => {
      resolveSubmit(SAVED);
      await first;
    });
    expect(result.current.sme.isSubmitting).toBe(false);
    expect(result.current.applicationId).toBe(APPLICATION_ID);
  });
});

describe("useSmeRequestState", () => {
  it("does not fetch without a gateway or an applicationId", async () => {
    const gw = gateway();
    const { result } = renderHook(() => useSmeRequestState(gw, null), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(gw.load).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  it("reads the application's own state by id, without the journey store", async () => {
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

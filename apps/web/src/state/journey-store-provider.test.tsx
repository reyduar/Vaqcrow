import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { JourneyStoreProvider, useJourneyStore } from "./journey-store-provider";

const wrapper = ({ children }: { children: ReactNode }) => <JourneyStoreProvider>{children}</JourneyStoreProvider>;

describe("JourneyStoreProvider", () => {
  it("reads and updates the store through the hook", () => {
    const { result } = renderHook(
      () => ({
        applicationId: useJourneyStore((s) => s.applicationId),
        record: useJourneyStore((s) => s.recordApplication)
      }),
      { wrapper }
    );
    expect(result.current.applicationId).toBeNull();
    act(() => result.current.record("app-1"));
    expect(result.current.applicationId).toBe("app-1");
  });

  it("seeds the store from the optional initial identifiers", () => {
    const { result } = renderHook(() => useJourneyStore((s) => s.applicationId), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <JourneyStoreProvider initial={{ applicationId: "app-seed" }}>{children}</JourneyStoreProvider>
      )
    });
    expect(result.current).toBe("app-seed");
  });

  it("throws a clear error outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useJourneyStore((s) => s.applicationId))).toThrow(/JourneyStoreProvider/);
    spy.mockRestore();
  });

  it("isolates two providers", () => {
    function Probe({ label }: { label: string }) {
      const id = useJourneyStore((s) => s.applicationId);
      const record = useJourneyStore((s) => s.recordApplication);
      return (
        <button onClick={() => record(label)} data-testid={label}>
          {id ?? "none"}
        </button>
      );
    }
    render(
      <>
        <JourneyStoreProvider>
          <Probe label="one" />
        </JourneyStoreProvider>
        <JourneyStoreProvider>
          <Probe label="two" />
        </JourneyStoreProvider>
      </>
    );
    act(() => screen.getByTestId("one").click());
    expect(screen.getByTestId("one").textContent).toBe("one");
    expect(screen.getByTestId("two").textContent).toBe("none");
  });
});

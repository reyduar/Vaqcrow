import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { FakeAuthSession } from "@/test/fake-auth-session";
import { SessionStoreProvider, useSession, useSessionStoreApi } from "./session-store-provider";

const ANA = { email: "ana@example.test", password: "secret-123", role: "INVERSOR", displayName: "Ana Pérez" } as const;

function wrapperFor(port: FakeAuthSession) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <SessionStoreProvider port={port}>{children}</SessionStoreProvider>;
  }
  return Wrapper;
}

describe("SessionStoreProvider", () => {
  it("resolves the initial session on mount", async () => {
    const fake = new FakeAuthSession();
    const { result } = renderHook(() => useSession((s) => s.status), { wrapper: wrapperFor(fake) });
    expect(result.current).toBe("loading");
    await waitFor(() => expect(result.current).toBe("signed-out"));
  });

  it("follows session changes made outside the store (another tab, token refresh)", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount(ANA);
    const { result } = renderHook(() => useSession((s) => s.principal), { wrapper: wrapperFor(fake) });
    await waitFor(() => expect(fake.listenerCount).toBe(1));

    await act(async () => {
      await fake.signIn({ email: ANA.email, password: ANA.password });
    });

    await waitFor(() => expect(result.current).toEqual({ role: "INVERSOR", displayName: "Ana Pérez" }));
  });

  it("unsubscribes on unmount", async () => {
    const fake = new FakeAuthSession();
    const { unmount } = renderHook(() => useSession((s) => s.status), { wrapper: wrapperFor(fake) });
    await waitFor(() => expect(fake.listenerCount).toBe(1));
    unmount();
    expect(fake.listenerCount).toBe(0);
  });

  it("exposes the actions through the store api", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount(ANA);
    const { result } = renderHook(
      () => ({ api: useSessionStoreApi(), status: useSession((s) => s.status) }),
      { wrapper: wrapperFor(fake) }
    );
    await waitFor(() => expect(result.current.status).toBe("signed-out"));

    await act(async () => {
      await result.current.api.getState().signIn({ email: ANA.email, password: ANA.password });
    });

    expect(result.current.status).toBe("signed-in");
  });

  it("throws a clear error outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useSession((s) => s.status))).toThrow(/SessionStoreProvider/);
    spy.mockRestore();
  });

  it("isolates two providers", async () => {
    const one = new FakeAuthSession();
    one.seedAccount(ANA);
    await one.signIn({ email: ANA.email, password: ANA.password });
    const two = new FakeAuthSession();
    function Probe({ id }: { id: string }) {
      const status = useSession((s) => s.status);
      return <span data-testid={id}>{status}</span>;
    }
    render(
      <>
        <SessionStoreProvider port={one}>
          <Probe id="one" />
        </SessionStoreProvider>
        <SessionStoreProvider port={two}>
          <Probe id="two" />
        </SessionStoreProvider>
      </>
    );
    await waitFor(() => expect(screen.getByTestId("one").textContent).toBe("signed-in"));
    await waitFor(() => expect(screen.getByTestId("two").textContent).toBe("signed-out"));
  });
});

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import { SessionStoreProvider, useSessionStoreApi } from "@/state/session-store-provider";
import type { SessionStore } from "@/state/session-store";
import { FakeAuthSession } from "@/test/fake-auth-session";
import { AppHeader } from "./app-header";
import { RouteGate } from "./route-gate";

const { push, replace, pathname } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  pathname: { current: "/portfolio" }
}));
// A fresh router object per render, as a worst case: the gate must not
// redirect again just because the router identity changed.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => pathname.current
}));

async function portFor(role: PrincipalRole | null) {
  const fake = new FakeAuthSession();
  if (role) {
    fake.seedAccount({ email: "p@example.test", password: "secret-123", role, displayName: "Persona" });
    await fake.signIn({ email: "p@example.test", password: "secret-123" });
  }
  return fake;
}

function StoreProbe({ onStore }: { onStore: (store: SessionStore) => void }) {
  onStore(useSessionStoreApi());
  return null;
}

function renderGate(port: FakeAuthSession, path: string) {
  pathname.current = path;
  let store!: SessionStore;
  const tree = () => (
    <SessionStoreProvider port={port}>
      <StoreProbe onStore={(value) => (store = value)} />
      <RouteGate>
        <p>Contenido protegido</p>
      </RouteGate>
    </SessionStoreProvider>
  );
  const view = render(tree());
  return { view, rerender: () => view.rerender(tree()), store: () => store };
}

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
});

describe("RouteGate", () => {
  it("renders nothing protected while the session is loading", async () => {
    const fake = await portFor("INVERSOR");
    fake.holdNextGetSession();
    renderGate(fake, "/portfolio");
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    [null, "/portfolio", "/login?role=investor"],
    [null, "/company", "/login?role=pyme"],
    [null, "/reports", "/login"],
    ["PYME", "/portfolio", "/company"],
    ["INVERSOR", "/company", "/portfolio"],
    ["ADMIN", "/company", "/"]
  ] as const)("%s on %s is sent to %s without seeing the content", async (role, path, target) => {
    renderGate(await portFor(role), path);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(target));
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it.each([
    ["INVERSOR", "/portfolio"],
    ["PYME", "/company"],
    ["INVERSOR", "/reports"],
    ["PYME", "/reports"],
    ["ADMIN", "/reports"]
  ] as const)("%s sees %s", async (role, path) => {
    renderGate(await portFor(role), path);
    expect(await screen.findByText("Contenido protegido")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("never repeats router.replace with the same target", async () => {
    const { rerender, store } = renderGate(await portFor(null), "/portfolio");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?role=investor"));

    rerender();
    await act(async () => {
      await store().getState().refresh();
    });
    rerender();

    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("does not redirect when the target is the current path", async () => {
    const fake = await portFor("INVERSOR");
    const { store } = renderGate(fake, "/");
    await waitFor(() => expect(store().getState().status).toBe("signed-in"));

    await act(async () => {
      await store().getState().signOut();
    });

    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps rendering the page after this tab's sign-out when it is already on the target", async () => {
    const fake = await portFor("INVERSOR");
    const { store } = renderGate(fake, "/");
    await waitFor(() => expect(store().getState().status).toBe("signed-in"));

    await act(async () => {
      await store().getState().signOut();
    });

    expect(store().getState().signedOutByUser).toBe(true);
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a protected page to / exactly once after this tab's sign-out", async () => {
    const fake = await portFor("INVERSOR");
    const { rerender, store } = renderGate(fake, "/portfolio");
    await screen.findByText("Contenido protegido");

    await act(async () => {
      await store().getState().signOut();
    });
    rerender();

    expect(replace.mock.calls).toEqual([["/"]]);
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it("lets the header's sign-out navigation win on a protected page", async () => {
    pathname.current = "/portfolio";
    const fake = await portFor("INVERSOR");
    render(
      <SessionStoreProvider port={fake}>
        <AppHeader />
        <RouteGate>
          <p>Contenido protegido</p>
        </RouteGate>
      </SessionStoreProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: "Menú de cuenta de Persona" }));

    await act(async () => {
      fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Cerrar sesión" }));
    });

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(replace).not.toHaveBeenCalledWith(expect.stringMatching(/^\/login/));
    expect(replace.mock.calls.filter(([target]) => target === "/").length).toBeLessThanOrEqual(1);
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });
});

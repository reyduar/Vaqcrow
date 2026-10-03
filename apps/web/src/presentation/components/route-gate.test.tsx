import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";
import { RouteGate } from "./route-gate";

const { replace, pathname } = vi.hoisted(() => ({ replace: vi.fn(), pathname: { current: "/portfolio" } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
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

function renderGate(port: FakeAuthSession, path: string) {
  pathname.current = path;
  render(
    <SessionStoreProvider port={port}>
      <RouteGate>
        <p>Contenido protegido</p>
      </RouteGate>
    </SessionStoreProvider>
  );
}

beforeEach(() => {
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
    ["PYME", "/company"]
  ] as const)("%s sees %s", async (role, path) => {
    renderGate(await portFor(role), path);
    expect(await screen.findByText("Contenido protegido")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

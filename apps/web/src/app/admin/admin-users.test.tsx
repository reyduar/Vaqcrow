import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "@/presentation/components/admin/admin-shell";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";
import AdminUsersPage from "./(console)/users/page";

const { pathname, push, replace } = vi.hoisted(() => ({
  pathname: { current: "/admin/pymes" },
  push: vi.fn(),
  replace: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => pathname.current
}));

function swr({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function adminSession(): FakeAuthSession {
  const fake = new FakeAuthSession();
  fake.seedAccount({ email: "op@vaqcrow.test", password: "secret-123", role: "ADMIN", displayName: "Admin Vaqcrow" });
  return fake;
}

beforeEach(() => {
  pathname.current = "/admin/pymes";
  push.mockClear();
  replace.mockClear();
});

describe("/admin/users route", () => {
  it("mounts the Usuarios view with its designed header", async () => {
    render(swr({ children: AdminUsersPage() }));

    expect(await screen.findByRole("heading", { level: 1, name: "Usuarios" })).toBeInTheDocument();
    expect(
      screen.getByText("Roles y acceso. Los cambios de rol piden confirmación y quedan auditados.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invitar operador" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Registro de auditoría" })).toBeInTheDocument();
  });

  it("stays honest with no configured backend instead of inventing rows", async () => {
    render(swr({ children: AdminUsersPage() }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((alert) => alert.textContent?.includes("No pudimos cargar los datos."))).toBe(true);
  });
});

describe("admin shell nav", () => {
  async function renderShell() {
    pathname.current = "/admin/users";
    const fake = adminSession();
    await fake.signIn({ email: "op@vaqcrow.test", password: "secret-123" });
    render(
      <SessionStoreProvider port={fake}>
        <AdminShell>
          <p>Contenido</p>
        </AdminShell>
      </SessionStoreProvider>,
      { wrapper: swr }
    );
    return fake;
  }

  it("links Usuarios to /admin/users, not a dead control", async () => {
    await renderShell();
    const link = await screen.findByRole("link", { name: /Usuarios/ });
    expect(link).toHaveAttribute("href", "/admin/users");
    expect(screen.queryByRole("button", { name: /Usuarios/ })).toBeNull();
  });

  it("marks Usuarios as the current page on /admin/users", async () => {
    await renderShell();
    const link = await screen.findByRole("link", { name: /Usuarios/ });
    expect(link).toHaveAttribute("aria-current", "page");
    const pymes = screen.getByRole("link", { name: /PyMEs/ });
    expect(pymes).not.toHaveAttribute("aria-current", "page");
    expect(within(pymes).queryByText("Usuarios")).toBeNull();
  });
});

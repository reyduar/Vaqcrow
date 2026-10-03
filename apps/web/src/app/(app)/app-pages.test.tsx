import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";
import CompanyPage from "./company/page";
import AppLayout from "./layout";
import PortfolioPage from "./portfolio/page";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/portfolio" } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => pathname.current
}));

async function renderAs(role: PrincipalRole, path: string, page: ReactNode) {
  pathname.current = path;
  const fake = new FakeAuthSession();
  fake.seedAccount({ email: "p@example.test", password: "secret-123", role, displayName: "Persona Demo" });
  await fake.signIn({ email: "p@example.test", password: "secret-123" });
  const view = render(
    <SessionStoreProvider port={fake}>
      <AppLayout>{page}</AppLayout>
    </SessionStoreProvider>
  );
  await screen.findByRole("heading", { level: 1 });
  return view;
}

describe("/portfolio", () => {
  it("shows the template's investor title and subtitle under the role-aware header", async () => {
    await renderAs("INVERSOR", "/portfolio", <PortfolioPage />);

    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1, name: "Mi portafolio" })).toBeInTheDocument();
    expect(
      within(main).getByText(
        "Tus aportes a bóvedas de campañas sintéticas en Stellar Testnet. Los fondos los custodia cada contrato, no una persona."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menú de cuenta de Persona Demo" })).toBeInTheDocument();
    expect(within(main).queryByText("Registrar mi PyME")).not.toBeInTheDocument();
  });
});

describe("/company", () => {
  it("shows the template's PyME title, subtitle and the unwired 'Registrar mi PyME' action", async () => {
    await renderAs("PYME", "/company", <CompanyPage />);

    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1, name: "Mi campaña" })).toBeInTheDocument();
    expect(
      within(main).getByText(
        "Estado de la bóveda de tu campaña y las distribuciones que tenés que firmar. Todo corre en Stellar Testnet con datos sintéticos."
      )
    ).toBeInTheDocument();
    const register = within(main).getByRole("button", { name: "Registrar mi PyME" });
    expect(register).toHaveAttribute("aria-disabled", "true");
    expect(within(main).queryByRole("link", { name: "Registrar mi PyME" })).not.toBeInTheDocument();
  });

  it("has no connect-wallet popup", async () => {
    await renderAs("PYME", "/company", <CompanyPage />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Conectá tu wallet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Conectar Freighter/)).not.toBeInTheDocument();
  });
});

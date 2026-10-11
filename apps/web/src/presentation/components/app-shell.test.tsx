import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { microcopy } from "@/application/trust/disclosures";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";
import { AppShell } from "./app-shell";
import { LandingFooter } from "./landing/landing-footer";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/portfolio" } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname.current
}));

async function renderShell(children: ReactNode, footer?: ReactNode) {
  // Signed out: no notification bell mounts, and the null marketplace port keeps
  // these tests off the network.
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
  const view = render(
    <SessionStoreProvider port={new FakeAuthSession()}>
      <AppShell footer={footer}>{children}</AppShell>
    </SessionStoreProvider>
  );
  // The header settles on «Ingresar», so the session-store update stays inside act.
  await screen.findByRole("link", { name: "Ingresar" });
  return view;
}

function footerOf(container: HTMLElement): HTMLElement {
  const footer = container.querySelector("footer");
  if (!footer) throw new Error("AppShell rendered no <footer>");
  return footer;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AppShell footer", () => {
  it("defaults to the compact SiteFooter, unchanged", async () => {
    const { container } = await renderShell(<p>contenido</p>);
    const footer = within(footerOf(container));

    expect(footer.getByText("Vaqcrow · 2026")).toBeInTheDocument();
    expect(footer.getByText(microcopy.testnetBadge)).toBeInTheDocument();
    // The landing's rich footer must not leak into other pages.
    expect(footer.queryByText("Vaqcrow · Trabajo Fin de Máster · 2026")).not.toBeInTheDocument();
    expect(footer.queryByRole("navigation", { name: "Plataforma" })).not.toBeInTheDocument();
  });

  it("renders a caller-supplied footer instead of the compact one", async () => {
    const { container } = await renderShell(<p>contenido</p>, <LandingFooter />);
    const footer = within(footerOf(container));

    expect(footer.getByRole("navigation", { name: "Plataforma" })).toBeInTheDocument();
    expect(footer.getByText("Vaqcrow · Trabajo Fin de Máster · 2026")).toBeInTheDocument();
    expect(footer.queryByText("Vaqcrow · 2026")).not.toBeInTheDocument();
  });
});

import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/"
}));

import Home from "./page";

const EMAIL = "persona@example.test";
const PASSWORD = "secret-123";
const DISPLAY_NAME = "Cuenta de prueba";

async function renderHome(role: PrincipalRole | null = null) {
  // A signed-in role mounts the notification bell; with no API base URL its
  // default port is the null object, so these tests never touch the network.
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
  const fake = new FakeAuthSession();
  if (role) {
    fake.seedAccount({ email: EMAIL, password: PASSWORD, role, displayName: DISPLAY_NAME });
    await fake.signIn({ email: EMAIL, password: PASSWORD });
  }
  render(
    <SessionStoreProvider port={fake}>
      <Home />
    </SessionStoreProvider>
  );
  // No API base URL means the marketplace island's port is the null object, so
  // the list settles on `unavailable`. Waiting for that error copy keeps the
  // SWR state update inside `act` rather than logging after the assertion.
  await screen.findByText("No pudimos cargar las campañas");
  return { fake, landing: within(await screen.findByRole("main")) };
}

beforeEach(() => {
  redirect.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Home landing (Feature #418)", () => {
  it("is the landing, not a redirect to the journey, and renders a footer with the canonical disclosure", async () => {
    await renderHome(null);

    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("No apto para producción")).toBeInTheDocument();
  });

  it("renders the landing's rich footer, not the compact shell footer", async () => {
    await renderHome(null);

    const footer = document.querySelector("footer");
    expect(footer).not.toBeNull();
    const rich = within(footer as HTMLElement);
    expect(rich.getByRole("navigation", { name: "Plataforma" })).toBeInTheDocument();
    expect(rich.getByText("Vaqcrow · Trabajo Fin de Máster · 2026")).toBeInTheDocument();
    expect(rich.getByText(microcopy.testnetBadge)).toBeInTheDocument();
    expect(rich.queryByText("Vaqcrow · 2026")).not.toBeInTheDocument();
  });

  it("opens with the hero heading and its primary CTA", async () => {
    const { landing } = await renderHome(null);

    expect(
      screen.getByRole("heading", { level: 1, name: "Capital para PyMEs, respaldado por sus ventas." })
    ).toBeInTheDocument();
    expect(landing.getByRole("link", { name: "Explorar PyMEs" })).toHaveAttribute("href", "/explore");
  });

  it("renders both explanatory section headings", async () => {
    const { landing } = await renderHome(null);

    expect(landing.getByRole("heading", { level: 2, name: "Cómo funciona" })).toBeInTheDocument();
    expect(landing.getByRole("heading", { level: 2, name: "Qué es real y qué es simulado" })).toBeInTheDocument();
  });

  it("renders the featured campaign inside the hero as its second grid column, not a separate section", async () => {
    await renderHome(null);

    const hero = document.querySelector("section[aria-labelledby='hero-t']");
    expect(hero).not.toBeNull();
    // The featured `article` (feat-t) shares the hero `<section>`: it is the grid's second column.
    expect(hero?.querySelector("[aria-labelledby='feat-t']")).not.toBeNull();
    // It must not be a sibling section rendered after the hero.
    expect(document.querySelector("main > section[aria-labelledby='feat-t']")).toBeNull();
  });

  it("keeps the template section order: hero (text | featured) → trust strip → grid → explanatory", async () => {
    const { landing } = await renderHome(null);

    // The featured card's h2 is inside the hero, so it precedes the grid heading.
    const headings = landing.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Panadería Horizonte SRL",
      "PyMEs en campaña",
      "Cómo funciona",
      "Qué es real y qué es simulado"
    ]);
  });

  it("renders the marketplace section heading and its link to /explore", async () => {
    const { landing } = await renderHome(null);

    expect(landing.getByRole("heading", { level: 2, name: "PyMEs en campaña" })).toBeInTheDocument();
    expect(landing.getByRole("link", { name: "Ver el marketplace" })).toHaveAttribute("href", "/explore");
  });

  it("anchors the Spanish in-page sections and the header link", async () => {
    const { landing } = await renderHome(null);

    expect(document.querySelector("#como-funciona")).not.toBeNull();
    expect(document.querySelector("#limites")).not.toBeNull();
    expect(landing.getByRole("link", { name: "Leer los límites de esta demo" })).toHaveAttribute("href", "#limites");

    const nav = within(screen.getByRole("navigation", { name: "Principal" }));
    expect(nav.getByRole("link", { name: "Cómo funciona" })).toHaveAttribute("href", "/#como-funciona");
  });

  it("renders the canonical simulation disclosure instead of retyped copy", async () => {
    await renderHome(null);

    expect(screen.getByText(disclosures.simulation.title)).toBeInTheDocument();
  });

  it("sends an anonymous visitor to /signup from the role-aware CTA", async () => {
    const { landing } = await renderHome(null);

    expect(await landing.findByRole("link", { name: "Quiero financiar mi negocio" })).toHaveAttribute(
      "href",
      "/signup"
    );
  });

  it("points a PyME at /company from the role-aware CTA", async () => {
    const { landing } = await renderHome("PYME");

    expect(await landing.findByRole("link", { name: "Quiero financiar mi negocio" })).toHaveAttribute(
      "href",
      "/company"
    );
  });

  it("hides the role-aware CTA from an investor", async () => {
    const { landing } = await renderHome("INVERSOR");

    // The header resolving the account menu proves the session settled; the
    // hero must not offer a "finance my business" CTA to an investor.
    await screen.findByRole("button", { name: `Menú de cuenta de ${DISPLAY_NAME}` });
    expect(landing.queryByRole("link", { name: "Quiero financiar mi negocio" })).not.toBeInTheDocument();
  });
});

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";
import { AppHeader } from "./app-header";

const { push, pathname } = vi.hoisted(() => ({ push: vi.fn(), pathname: { current: "/" } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname.current
}));

const EMAIL = "persona@example.test";
const PASSWORD = "secret-123";
const NAMES: Record<PrincipalRole, string> = {
  INVERSOR: "Lucía Fernández",
  PYME: "Panadería Horizonte SRL",
  ADMIN: "Admin Vaqcrow"
};

async function renderHeader(role: PrincipalRole | null, path = "/") {
  pathname.current = path;
  const fake = new FakeAuthSession();
  if (role) {
    fake.seedAccount({ email: EMAIL, password: PASSWORD, role, displayName: NAMES[role] });
    await fake.signIn({ email: EMAIL, password: PASSWORD });
  }
  const view = render(
    <SessionStoreProvider port={fake}>
      <AppHeader />
    </SessionStoreProvider>
  );
  if (role) await screen.findByRole("button", { name: `Menú de cuenta de ${NAMES[role]}` });
  else await screen.findByRole("link", { name: "Ingresar" });
  return { fake, view };
}

function navLinks() {
  return within(screen.getByRole("navigation", { name: "Principal" }))
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

function openMenu(role: PrincipalRole) {
  fireEvent.click(screen.getByRole("button", { name: `Menú de cuenta de ${NAMES[role]}` }));
  return screen.getByRole("menu");
}

function expectNoAdminLinkAndNoEmail(container: HTMLElement) {
  for (const link of container.querySelectorAll("a")) {
    expect(link.getAttribute("href")?.startsWith("/admin")).toBe(false);
  }
  expect(container.innerHTML).not.toContain("example.test");
}

beforeEach(() => {
  push.mockReset();
});

describe("AppHeader signed out", () => {
  it("shows the public nav, the badges, the theme switcher and the auth actions", async () => {
    const { view } = await renderHeader(null);

    expect(navLinks()).toEqual([
      ["Explorar PyMEs", "/explore"],
      ["Cómo funciona", "/#how-it-works"],
      ["Para emprendedores", "/entrepreneur-guide"],
      ["Acerca de", "/about"]
    ]);
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute("href", "/signup");
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByText("TESTNET · Activos sin valor económico")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Tema" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Menú de cuenta/ })).not.toBeInTheDocument();
    expectNoAdminLinkAndNoEmail(view.container);
  });

  it("shows no auth actions while the session is still loading", () => {
    pathname.current = "/";
    const fake = new FakeAuthSession();
    fake.holdNextGetSession();
    render(
      <SessionStoreProvider port={fake}>
        <AppHeader />
      </SessionStoreProvider>
    );
    expect(screen.queryByRole("link", { name: "Ingresar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Menú de cuenta/ })).not.toBeInTheDocument();
  });
});

describe("AppHeader INVERSOR", () => {
  it("shows exactly the investor nav and marks the current page", async () => {
    const { view } = await renderHeader("INVERSOR", "/portfolio");

    expect(navLinks()).toEqual([
      ["Explorar PyMEs", "/explore"],
      ["Mi portafolio", "/portfolio"],
      ["Acerca de", "/about"]
    ]);
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(within(nav).getByRole("link", { name: "Mi portafolio" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Explorar PyMEs" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("link", { name: "Ingresar" })).not.toBeInTheDocument();
    expectNoAdminLinkAndNoEmail(view.container);
  });

  it("opens the investor avatar menu with the role chip and the role avatar", async () => {
    const { view } = await renderHeader("INVERSOR");
    const menu = openMenu("INVERSOR");

    expect(within(menu).getByText("Lucía Fernández")).toBeInTheDocument();
    expect(within(menu).getByText("INVERSOR")).toBeInTheDocument();
    expect(within(menu).queryByText("Sesión de demostración")).not.toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => [item.textContent, item.getAttribute("href")])
    ).toEqual([
      ["Mi portafolio", "/portfolio"],
      ["Guía del inversor", "/investor-guide"],
      ["Informes", "/reports"],
      ["Cerrar sesión", null]
    ]);
    expect(view.container.querySelector('[data-avatar-src="/avatar-inversor.png"]')).not.toBeNull();
    expectNoAdminLinkAndNoEmail(view.container);
  });

  it("closes the menu on Escape and on an outside click", async () => {
    await renderHeader("INVERSOR");
    openMenu("INVERSOR");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    openMenu("INVERSOR");
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("signs out through the port and navigates home", async () => {
    const { fake } = await renderHeader("INVERSOR", "/portfolio");
    const menu = openMenu("INVERSOR");

    await act(async () => {
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Cerrar sesión" }));
    });

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(await fake.getSession()).toEqual({ status: "signed-out" });
    expect(await screen.findByRole("link", { name: "Ingresar" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stays on the page and says so when signing out fails", async () => {
    const { fake } = await renderHeader("INVERSOR", "/portfolio");
    fake.failNext("signOut", "network");

    const menu = openMenu("INVERSOR");
    await act(async () => {
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Cerrar sesión" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cerrar la sesión. Volvé a intentar.");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: `Menú de cuenta de ${NAMES.INVERSOR}` })).toBeInTheDocument();
    expect(await fake.getSession()).toMatchObject({ status: "signed-in" });

    // A later successful attempt clears the error and goes home.
    const again = openMenu("INVERSOR");
    await act(async () => {
      fireEvent.click(within(again).getByRole("menuitem", { name: "Cerrar sesión" }));
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("AppHeader PYME", () => {
  it("shows exactly the PyME nav and menu", async () => {
    const { view } = await renderHeader("PYME", "/company");

    expect(navLinks()).toEqual([
      ["Mi campaña", "/company"],
      ["Cómo funciona", "/#how-it-works"],
      ["Acerca de", "/about"]
    ]);
    expect(
      within(screen.getByRole("navigation", { name: "Principal" })).getByRole("link", { name: "Mi campaña" })
    ).toHaveAttribute("aria-current", "page");

    const menu = openMenu("PYME");
    expect(within(menu).getByText("PYME")).toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => [item.textContent, item.getAttribute("href")])
    ).toEqual([
      ["Mi campaña", "/company"],
      ["Guía del emprendedor", "/entrepreneur-guide"],
      ["Cerrar sesión", null]
    ]);
    expect(view.container.querySelector('[data-avatar-src="/avatar-pyme.png"]')).not.toBeNull();
    expectNoAdminLinkAndNoEmail(view.container);
  });
});

describe("AppHeader ADMIN", () => {
  it("never links to /admin and offers only sign-out", async () => {
    const { view } = await renderHeader("ADMIN");
    const menu = openMenu("ADMIN");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Cerrar sesión"]);
    expectNoAdminLinkAndNoEmail(view.container);
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { microcopy } from "@/application/trust/disclosures";
import { DemoNavbar, type DemoNavItem } from "./demo-navbar";

const ITEMS: readonly DemoNavItem[] = [
  { label: "Registro de PyME", href: "/request", current: true },
  { label: "Mi campaña", href: "/portfolio" },
  { label: "Cómo funciona", href: "/#como-funciona" }
];

describe("DemoNavbar", () => {
  it("renders the sticky header chrome", () => {
    const { container } = render(<DemoNavbar items={ITEMS} />);

    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(header?.className ?? "").toMatch(/\bsticky\b/);
    expect(header?.className ?? "").toMatch(/\btop-0\b/);
  });

  it("renders the brand as a single link with an accessible name", () => {
    render(<DemoNavbar items={ITEMS} />);

    const brand = screen.getByRole("link", { name: "Vaqcrow, inicio" });
    expect(brand).toHaveAttribute("href", "/");
    expect(brand).toHaveTextContent("Vaqcrow");
  });

  it("renders both environment badges with their canonical labels", () => {
    render(<DemoNavbar items={ITEMS} />);

    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByText(microcopy.testnetBadge)).toBeInTheDocument();
  });

  it("renders every caller item as a real link in the primary nav", () => {
    render(<DemoNavbar items={ITEMS} />);

    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(within(nav).getAllByRole("link")).toHaveLength(ITEMS.length);
    expect(within(nav).getByRole("link", { name: "Mi campaña" })).toHaveAttribute(
      "href",
      "/portfolio"
    );
    expect(within(nav).getByRole("link", { name: "Cómo funciona" })).toHaveAttribute(
      "href",
      "/#como-funciona"
    );
  });

  it("marks the current item with aria-current=page and a non-colour underline cue", () => {
    render(<DemoNavbar items={ITEMS} />);

    const current = screen.getByRole("link", { name: "Registro de PyME" });
    expect(current).toHaveAttribute("aria-current", "page");
    // The shape cue is a 2px underline; the brand token sets its colour.
    expect(current.className).toMatch(/\bborder-b-2\b/);
    expect(current.className).toMatch(/brand-accent/);

    const inactive = screen.getByRole("link", { name: "Mi campaña" });
    expect(inactive).not.toHaveAttribute("aria-current");
    expect(inactive.className).not.toMatch(/\bborder-b-2\b/);
  });

  it("collapses behind a real disclosure and toggles both aria-expanded and the nav state", () => {
    render(<DemoNavbar items={ITEMS} />);

    const toggle = screen.getByRole("button", { name: "Menú" });
    const nav = screen.getByRole("navigation", { name: "Principal" });

    expect(toggle).toHaveAttribute("aria-controls", nav.id);
    expect(nav.id).not.toBe("");
    expect(document.getElementById(nav.id)).toBe(nav);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav).toHaveAttribute("data-state", "closed");
    expect(nav.className).toMatch(/\bhidden\b/);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(nav).toHaveAttribute("data-state", "open");
    expect(nav.className).toMatch(/\bflex\b/);
    expect(nav.className).not.toMatch(/\bhidden\b/);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav).toHaveAttribute("data-state", "closed");
    expect(nav.className).toMatch(/\bhidden\b/);
  });

  it("renders the actions slot at the right end when provided", () => {
    render(
      <DemoNavbar items={ITEMS} actions={<button type="button">Abrir cuenta</button>} />
    );

    expect(screen.getByRole("button", { name: "Abrir cuenta" })).toBeInTheDocument();
  });

  it("omits the actions slot when not provided", () => {
    render(<DemoNavbar items={ITEMS} />);

    expect(screen.queryByRole("button", { name: "Abrir cuenta" })).not.toBeInTheDocument();
  });

  it("keeps every caller label when the list is long", () => {
    const long = Array.from({ length: 12 }, (_, index) => ({
      label: `Enlace ${index + 1}`,
      href: `/enlace/${index + 1}`
    }));

    render(<DemoNavbar items={long} />);

    const nav = screen.getByRole("navigation", { name: "Principal" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(12);
    expect(links[0]!).toHaveTextContent("Enlace 1");
    expect(links[11]!).toHaveTextContent("Enlace 12");
  });

  it("renders no current item when none is flagged", () => {
    render(<DemoNavbar items={ITEMS.map(({ label, href }) => ({ label, href }))} />);

    const nav = screen.getByRole("navigation", { name: "Principal" });
    for (const link of within(nav).getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("lets the caller override the brand target and nav label", () => {
    render(<DemoNavbar items={ITEMS} brandHref="/inicio" navLabel="Secciones" />);

    expect(screen.getByRole("link", { name: "Vaqcrow, inicio" })).toHaveAttribute("href", "/inicio");
    expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();
  });
});

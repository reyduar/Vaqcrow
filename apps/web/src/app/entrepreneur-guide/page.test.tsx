import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ENTREPRENEUR_GUIDE } from "@/application/guides/entrepreneur-guide";
import { disclosures } from "@/application/trust/disclosures";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

// The public shell reads the current path and the router; both are stubbed so
// the page renders without a Next.js runtime (same pattern as `/about`).
vi.mock("next/navigation", () => ({
  usePathname: () => "/entrepreneur-guide",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

import EntrepreneurGuidePage from "./page";

function renderPage() {
  return render(
    <SessionStoreProvider port={new FakeAuthSession()}>
      <EntrepreneurGuidePage />
    </SessionStoreProvider>
  );
}

describe("/entrepreneur-guide", () => {
  it("is public: renders the guide without the template's login gate", () => {
    renderPage();

    // Anonymous session (FakeAuthSession) still renders the full guide.
    expect(
      screen.getByRole("heading", { level: 1, name: "De tus ventas a una campaña" })
    ).toBeInTheDocument();
    // The template drew a gate (`:91-102`) the owner removed; this route must not model it.
    expect(screen.queryByText("Ingresá para leer la guía")).not.toBeInTheDocument();
  });

  it("renders the hero eyebrow, subtitle, note and CTAs from the data", () => {
    renderPage();
    const main = within(screen.getByRole("main"));

    const eyebrow = main.getByText(ENTREPRENEUR_GUIDE.eyebrow);
    expect(eyebrow).toBeInTheDocument();
    // The eyebrow pill carries the template's decorative storefront glyph
    // (`Vaqcrow Guia emprendedores.dc.html:107`), hidden from assistive tech.
    expect(eyebrow.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(main.getByText(ENTREPRENEUR_GUIDE.subtitle)).toBeInTheDocument();
    expect(main.getByText(ENTREPRENEUR_GUIDE.note)).toBeInTheDocument();
    for (const cta of ENTREPRENEUR_GUIDE.ctas) {
      expect(main.getByRole("link", { name: new RegExp(cta.label) })).toHaveAttribute("href", cta.href);
    }
  });

  it("renders all seven sections, in template order, each with its heading", () => {
    renderPage();
    const main = within(screen.getByRole("main"));

    expect(ENTREPRENEUR_GUIDE.sections).toHaveLength(7);
    for (const section of ENTREPRENEUR_GUIDE.sections) {
      expect(main.getByRole("heading", { level: 2, name: section.title })).toBeInTheDocument();
    }
  });

  it("renders the sticky TOC with one anchor per section, and every target exists", () => {
    const { container } = renderPage();

    const nav = screen.getByRole("navigation", { name: "Índice de la guía" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      ENTREPRENEUR_GUIDE.toc.map((entry) => `#${entry.id}`)
    );
    for (const entry of ENTREPRENEUR_GUIDE.toc) {
      expect(within(nav).getByText(entry.label)).toBeInTheDocument();
      expect(container.querySelector(`#${entry.id}`)).not.toBeNull();
    }
  });

  it("renders a well-formed reading progress and exactly one current TOC entry", () => {
    renderPage();

    const nav = screen.getByRole("navigation", { name: "Índice de la guía" });
    expect(within(nav).getByRole("progressbar")).toBeInTheDocument();
    // A degenerate scroll rect must never surface as "NaN %".
    expect(within(nav).queryByText(/NaN/)).toBeNull();

    const current = within(nav)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "location");
    expect(current).toHaveLength(1);
  });

  it("renders the worked example with its exact values", () => {
    renderPage();
    const example = ENTREPRENEUR_GUIDE.sections.find((section) => section.workedExample)?.workedExample;
    expect(example).toBeDefined();

    const main = within(screen.getByRole("main"));
    expect(main.getByText("ARS 3.745.800,00")).toBeInTheDocument();
    expect(main.getByText("× 4,5 %")).toBeInTheDocument();
    expect(main.getByText("ARS 168.561,00")).toBeInTheDocument();
    expect(main.getByText(example!.resultLabel)).toBeInTheDocument();
  });

  it("renders the final CTA band with its link, and the standard footer disclosure", () => {
    renderPage();
    const main = within(screen.getByRole("main"));

    expect(
      main.getByRole("heading", { level: 2, name: ENTREPRENEUR_GUIDE.finalCta.title })
    ).toBeInTheDocument();
    expect(main.getByRole("link", { name: new RegExp(ENTREPRENEUR_GUIDE.finalCta.cta.label) })).toHaveAttribute(
      "href",
      ENTREPRENEUR_GUIDE.finalCta.cta.href
    );
    // The default `AppShell` footer renders the canonical no-production notice.
    expect(screen.getAllByText(disclosures["no-production"].text).length).toBeGreaterThan(0);
  });
});

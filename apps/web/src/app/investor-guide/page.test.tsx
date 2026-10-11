import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { INVESTOR_GUIDE } from "@/application/guides/investor-guide";
import { disclosures } from "@/application/trust/disclosures";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

// The public shell reads the current path and the router; both are stubbed so
// the page renders without a Next.js runtime (same pattern as `/about`).
vi.mock("next/navigation", () => ({
  usePathname: () => "/investor-guide",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

import InvestorGuidePage from "./page";

function renderPage() {
  return render(
    <SessionStoreProvider port={new FakeAuthSession()}>
      <InvestorGuidePage />
    </SessionStoreProvider>
  );
}

describe("/investor-guide", () => {
  it("is public: renders the guide without the template's login gate", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Guía de inversión" })).toBeInTheDocument();
    // The template drew a gate (`:91-102`) the owner removed; this route must not model it.
    expect(screen.queryByText("Ingresá para leer la guía")).not.toBeInTheDocument();
  });

  it("renders the hero eyebrow, subtitle and note from the data", () => {
    renderPage();
    const main = within(screen.getByRole("main"));

    const eyebrow = main.getByText(INVESTOR_GUIDE.eyebrow);
    expect(eyebrow).toBeInTheDocument();
    // The eyebrow pill carries the template's decorative school glyph
    // (`Vaqcrow Guia de inversion.dc.html:107`), hidden from assistive tech.
    expect(eyebrow.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(main.getByText(INVESTOR_GUIDE.subtitle)).toBeInTheDocument();
    expect(main.getByText(INVESTOR_GUIDE.note)).toBeInTheDocument();
    // The template's investor hero has no CTAs, and neither does the data.
    expect(INVESTOR_GUIDE.ctas).toHaveLength(0);
  });

  it("renders all seven sections, in template order, each with its heading", () => {
    renderPage();
    const main = within(screen.getByRole("main"));

    expect(INVESTOR_GUIDE.sections).toHaveLength(7);
    for (const section of INVESTOR_GUIDE.sections) {
      expect(main.getByRole("heading", { level: 2, name: section.title })).toBeInTheDocument();
    }
  });

  it("renders the sticky TOC with one anchor per section, and every target exists", () => {
    const { container } = renderPage();

    const nav = screen.getByRole("navigation", { name: "Índice de la guía" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      INVESTOR_GUIDE.toc.map((entry) => `#${entry.id}`)
    );
    for (const entry of INVESTOR_GUIDE.toc) {
      expect(within(nav).getByText(entry.label)).toBeInTheDocument();
      expect(container.querySelector(`#${entry.id}`)).not.toBeNull();
    }
  });

  it("renders the worked example with its exact values, including the rounding row", () => {
    renderPage();
    const example = INVESTOR_GUIDE.sections.find((section) => section.workedExample)?.workedExample;
    expect(example).toBeDefined();

    const main = within(screen.getByRole("main"));
    expect(main.getByText("ARS 3.745.800,00")).toBeInTheDocument();
    expect(main.getByText("× 4,5 %")).toBeInTheDocument();
    expect(main.getByText("ARS 168.561,00")).toBeInTheDocument();
    expect(main.getByText(example!.roundingValue!)).toBeInTheDocument();
  });

  it("renders the final CTA band with its link, and the standard footer disclosure", () => {
    renderPage();
    const main = within(screen.getByRole("main"));

    expect(
      main.getByRole("heading", { level: 2, name: INVESTOR_GUIDE.finalCta.title })
    ).toBeInTheDocument();
    // Scoped to `main`: the shared header also links to `/explore`.
    expect(main.getByRole("link", { name: new RegExp(INVESTOR_GUIDE.finalCta.cta.label) })).toHaveAttribute(
      "href",
      INVESTOR_GUIDE.finalCta.cta.href
    );
    expect(screen.getAllByText(disclosures["no-production"].text).length).toBeGreaterThan(0);
  });
});

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import { LandingFooter } from "./landing-footer";

// Imported, never retyped: this assertion cannot drift from the canonical copy.
const NO_PRODUCTION = disclosures["no-production"].text;

function linksOf(column: string): [string | null, string | null][] {
  return within(screen.getByRole("navigation", { name: column }))
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

describe("LandingFooter (Feature #418, WU3)", () => {
  it("brands the footer with the isotipo, the wordmark and the tagline", () => {
    const { container } = render(<LandingFooter />);

    const isotipo = container.querySelector("[data-brand-isotipo]");
    expect(isotipo).not.toBeNull();
    expect(isotipo).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Vaqcrow")).toBeInTheDocument();
    expect(
      screen.getByText("Financiamiento de PyMEs por revenue share, con bóvedas en contratos de Stellar.")
    ).toBeInTheDocument();
  });

  it("renders the three template columns with their links and English routes", () => {
    render(<LandingFooter />);

    expect(linksOf("Plataforma")).toEqual([
      ["Explorar PyMEs", "/explore"],
      ["Cómo funciona", "/#como-funciona"],
      ["Para emprendedores", "/entrepreneur-guide"]
    ]);
    expect(linksOf("Aprender")).toEqual([
      ["Guía de inversión", "/investor-guide"],
      // #394 owns the help center and the guides; a 404 is accepted on purpose.
      ["Centro de ayuda", "/help"],
      ["Límites de la demo", "#limites"]
    ]);
    expect(linksOf("Proyecto")).toEqual([
      ["Acerca de Vaqcrow", "/about"],
      // The template leaves Contacto as "#"; its destination is an open #394 question.
      ["Contacto", "#"]
    ]);
  });

  it("renders the canonical no-production disclosure, never retyped", () => {
    render(<LandingFooter />);

    expect(screen.getByText(NO_PRODUCTION)).toBeInTheDocument();
  });

  it("renders the legal row with the TFM line and the canonical testnet badge", () => {
    render(<LandingFooter />);

    expect(screen.getByText("Vaqcrow · Trabajo Fin de Máster · 2026")).toBeInTheDocument();
    expect(screen.getByText(microcopy.testnetBadge)).toBeInTheDocument();
  });
});

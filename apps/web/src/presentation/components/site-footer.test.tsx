import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TERMS_COPY } from "@/application/legal/terms";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import { SiteFooter } from "./site-footer";

// Imported, never retyped: this assertion cannot drift from the canonical copy.
const NO_PRODUCTION = disclosures["no-production"].text;

describe("SiteFooter", () => {
  it("renders the canonical no-production disclosure verbatim", () => {
    render(<SiteFooter />);

    expect(screen.getByText(NO_PRODUCTION)).toBeInTheDocument();
  });

  it("renders the legal row from the caller-supplied strings", () => {
    render(
      <SiteFooter
        copyright="Vaqcrow · Trabajo Fin de Máster · 2026"
        environment={microcopy.testnetBadge}
      />
    );

    expect(screen.getByText("Vaqcrow · Trabajo Fin de Máster · 2026")).toBeInTheDocument();
    expect(screen.getByText(microcopy.testnetBadge)).toBeInTheDocument();
  });

  it("omits the caller-supplied strings when none are provided (the terms trigger stays)", () => {
    render(<SiteFooter />);

    expect(
      screen.queryByText("Vaqcrow · Trabajo Fin de Máster · 2026")
    ).not.toBeInTheDocument();
    // The disclosure stays: only the caller-supplied lines are conditional.
    expect(screen.getByText(NO_PRODUCTION)).toBeInTheDocument();
  });

  it("renders only the string that was provided", () => {
    render(<SiteFooter environment={microcopy.testnetBadge} />);

    expect(screen.getByText(microcopy.testnetBadge)).toBeInTheDocument();
    expect(
      screen.queryByText("Vaqcrow · Trabajo Fin de Máster · 2026")
    ).not.toBeInTheDocument();
  });

  it("wraps the notice in a bordered top chrome", () => {
    const { container } = render(<SiteFooter />);

    const footer = container.querySelector("footer");
    expect(footer).not.toBeNull();
    expect(footer?.className ?? "").toMatch(/\bborder-t\b/);
  });

  it("renders the Términos trigger in the legal row and opens the terms modal with its content", () => {
    render(<SiteFooter copyright="Vaqcrow · 2026" environment={microcopy.testnetBadge} />);

    fireEvent.click(screen.getByRole("button", { name: "Términos" }));

    expect(screen.getByRole("dialog", { name: TERMS_COPY.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aceptación" })).toBeInTheDocument();
    expect(screen.getByText(/contact@vaqcrow\.com/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: TERMS_COPY.contact.label })).toHaveAttribute(
      "href",
      TERMS_COPY.contact.href
    );
  });

  it("closes the terms modal on Escape and on the close button", () => {
    render(<SiteFooter copyright="Vaqcrow · 2026" />);

    fireEvent.click(screen.getByRole("button", { name: "Términos" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Términos" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar términos" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the Términos trigger reachable with no legal strings", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("button", { name: "Términos" })).toBeInTheDocument();
    expect(
      screen.queryByText("Vaqcrow · Trabajo Fin de Máster · 2026")
    ).not.toBeInTheDocument();
  });
});

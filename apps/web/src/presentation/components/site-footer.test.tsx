import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

  it("omits the legal row when no strings are provided", () => {
    render(<SiteFooter />);

    expect(
      screen.queryByText("Vaqcrow · Trabajo Fin de Máster · 2026")
    ).not.toBeInTheDocument();
    // The disclosure stays: only the legal row is conditional.
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
});

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import { DemoShell } from "./demo-shell";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname
}));

describe("DemoShell", () => {
  it("renders the step heading, progress, children, and step nav for a valid demo route", () => {
    usePathname.mockReturnValue("/approval");

    render(
      <DemoShell>
        <p>Step body content</p>
      </DemoShell>
    );

    expect(screen.getByRole("heading", { name: "Approval" })).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 6: Approval")).toBeInTheDocument();
    expect(screen.getByText("Step body content")).toBeInTheDocument();

    // The six step labels are also primary-nav links now, so the step nav
    // assertions are scoped to its own landmark to stay unambiguous.
    const stepNav = within(screen.getByRole("navigation", { name: "Demo step navigation" }));
    expect(stepNav.getByRole("link", { name: "AI Assessment" })).toHaveAttribute(
      "href",
      "/ai-assessment"
    );
    expect(stepNav.getByRole("link", { name: "Funding" })).toHaveAttribute("href", "/funding");
  });

  it("renders the persistent navigation chrome: navbar, current step, account identity, theme switcher, and footer", () => {
    usePathname.mockReturnValue("/approval");

    render(
      <DemoShell>
        <p>Step body content</p>
      </DemoShell>
    );

    const primaryNav = screen.getByRole("navigation", { name: "Principal" });
    expect(primaryNav).toBeInTheDocument();
    expect(within(primaryNav).getByRole("link", { name: "Approval" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(primaryNav).getByRole("link", { name: "Request" })).not.toHaveAttribute(
      "aria-current"
    );

    // `TrustBanner` renders its own inner `<header>`, so the footer disclosure
    // also maps to the `banner` role; the chrome badges are asserted without
    // relying on the navbar being the only banner.
    expect(screen.getByRole("link", { name: "Vaqcrow, inicio" })).toBeInTheDocument();
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getAllByText(microcopy.testnetBadge).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Sesión de demostración")).toBeInTheDocument();
    expect(screen.getByText("PyME")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Tema" })).toBeInTheDocument();

    expect(screen.getByText(disclosures["no-production"].text)).toBeInTheDocument();
  });

  it("renders only children (plus the persistent chrome) when the pathname is not a valid demo route", () => {
    usePathname.mockReturnValue("/not-a-step");

    render(
      <DemoShell>
        <p>Fallback content</p>
      </DemoShell>
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
    expect(screen.getByText(disclosures["no-production"].text)).toBeInTheDocument();
  });
});

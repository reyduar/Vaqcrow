import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DemoShell } from "./demo-shell";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname
}));

describe("DemoShell", () => {
  it("renders the step heading, progress, children, and nav for a valid demo route", () => {
    usePathname.mockReturnValue("/approval");

    render(
      <DemoShell>
        <p>Step body content</p>
      </DemoShell>
    );

    expect(screen.getByRole("heading", { name: "Approval" })).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 6: Approval")).toBeInTheDocument();
    expect(screen.getByText("Step body content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AI Assessment" })).toHaveAttribute(
      "href",
      "/ai-assessment"
    );
    expect(screen.getByRole("link", { name: "Funding" })).toHaveAttribute("href", "/funding");
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByText("TESTNET · Activos sin valor económico")).toBeInTheDocument();
  });

  it("renders only children (plus the persistent environment header) when the pathname is not a valid demo route", () => {
    usePathname.mockReturnValue("/not-a-step");

    render(
      <DemoShell>
        <p>Fallback content</p>
      </DemoShell>
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByText("TESTNET · Activos sin valor económico")).toBeInTheDocument();
  });
});

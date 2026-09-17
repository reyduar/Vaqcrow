import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DemoLayout from "./layout";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname
}));

describe("DemoLayout", () => {
  it("renders the demo shell chrome around its children for a valid demo route", () => {
    usePathname.mockReturnValue("/request");

    render(
      <DemoLayout>
        <p>Step body content</p>
      </DemoLayout>
    );

    expect(screen.getByRole("heading", { name: "Request" })).toBeInTheDocument();
    expect(screen.getByText("Step body content")).toBeInTheDocument();
  });
});

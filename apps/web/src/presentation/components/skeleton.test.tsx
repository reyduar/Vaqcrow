import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Skeleton } from "./skeleton";

function mockPrefersReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  );
}

describe("Skeleton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a single role=status region with visually-hidden loading text", () => {
    mockPrefersReducedMotion(false);
    render(<Skeleton label="Cargando campañas…" />);

    const region = screen.getByRole("status");
    expect(region).toBeInTheDocument();
    expect(screen.getByText("Cargando campañas…")).toHaveClass("sr-only");
  });

  it("marks the decorative shapes aria-hidden", () => {
    mockPrefersReducedMotion(false);
    render(<Skeleton shapes={["line", "block"]} />);

    const region = screen.getByRole("status");
    const hiddenContainer = region.querySelector('[aria-hidden="true"]');
    expect(hiddenContainer).not.toBeNull();
    expect(hiddenContainer?.children).toHaveLength(2);
  });

  it("animates by default when the user has no reduced-motion preference", () => {
    mockPrefersReducedMotion(false);
    render(<Skeleton />);

    const region = screen.getByRole("status");
    const shape = region.querySelector(".skeleton");
    expect(shape).toHaveClass("skeleton--shimmer");
  });

  it("disables the animation when prefers-reduced-motion: reduce is set", () => {
    mockPrefersReducedMotion(true);
    render(<Skeleton />);

    const region = screen.getByRole("status");
    const shape = region.querySelector(".skeleton");
    expect(shape).toHaveClass("skeleton--none");
    expect(shape).not.toHaveClass("skeleton--shimmer");
  });
});

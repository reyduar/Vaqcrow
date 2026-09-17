/**
 * Scope boundary (spec obs #386, design D4): this suite proves React's error
 * boundary contract in isolation — a real class-based boundary catching a
 * render-time throw and recovering on retry, with the real `DemoRouteError`
 * fallback (default export of `./error`, untouched). It does NOT, and
 * cannot, prove Next.js App Router's route-segment-level error wiring
 * (where the framework itself instantiates the boundary around a route
 * segment) — jsdom/Vitest has no App Router runtime to exercise that layer.
 * This is a stated scope boundary, not something to work around here.
 */
import { Component, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DemoRouteError from "./error";

// React 19 logs caught render errors via `console.error` (`onCaughtError`),
// not `reportError`. Silence that expected noise; never assert on it.
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

interface BoundaryState {
  readonly error: Error | null;
}

interface BoundaryProps {
  readonly children: ReactNode;
}

class TestErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(): void {
    // Intentionally empty — getDerivedStateFromError already captured state.
  }

  override render() {
    if (this.state.error) {
      return (
        <DemoRouteError
          error={this.state.error}
          reset={() => this.setState({ error: null })}
        />
      );
    }

    return this.props.children;
  }
}

// Closure-scoped flag read at render time. `getDerivedStateFromError` alone
// cannot recover the child: clearing boundary state re-renders the same
// `children` prop passed by the parent, and that element still throws
// unless the condition it evaluates at render time has changed first.
let shouldThrow = true;

function FlakyStep() {
  if (shouldThrow) {
    throw new Error("step exploded");
  }
  return <p>Recovered step content</p>;
}

describe("Demo route error boundary recovery", () => {
  beforeEach(() => {
    shouldThrow = true;
  });

  it("catches a render-time throw and renders the real DemoRouteError fallback", () => {
    render(
      <TestErrorBoundary>
        <FlakyStep />
      </TestErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("Recovered step content")).not.toBeInTheDocument();
  });

  it("genuinely recovers the child when retry is activated after the fault clears", () => {
    render(
      <TestErrorBoundary>
        <FlakyStep />
      </TestErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Recovered step content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DemoRouteError from "./error";

describe("Error (demo route group)", () => {
  it("renders the shared demo step error UI", () => {
    render(<DemoRouteError error={new Error("boom")} reset={() => {}} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("calls reset (not a full reload) when the retry control is activated", () => {
    const reset = vi.fn();
    render(<DemoRouteError error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});

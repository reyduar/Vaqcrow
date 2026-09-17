import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DemoStepError } from "./demo-step-error";

describe("DemoStepError", () => {
  it("renders a distinct error status region", () => {
    render(<DemoStepError onRetry={() => {}} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders a retry control", () => {
    render(<DemoStepError onRetry={() => {}} />);

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("invokes onRetry exactly once when the retry control is activated", () => {
    const onRetry = vi.fn();
    render(<DemoStepError onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

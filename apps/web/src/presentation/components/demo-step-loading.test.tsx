import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoStepLoading } from "./demo-step-loading";

describe("DemoStepLoading", () => {
  it("renders a distinct loading status region", () => {
    render(<DemoStepLoading />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders loading text describing the current step is loading", () => {
    render(<DemoStepLoading />);

    expect(screen.getByText("Loading step…")).toBeInTheDocument();
  });
});

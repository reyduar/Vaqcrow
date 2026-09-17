import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepPlaceholder } from "./step-placeholder";

describe("StepPlaceholder", () => {
  it("renders a structural level-2 heading for the placeholder body", () => {
    render(<StepPlaceholder />);

    expect(screen.getByRole("heading", { level: 2, name: "Step content coming soon" })).toBeInTheDocument();
  });

  it("does not render any SIMULADO or TESTNET disclosure copy", () => {
    render(<StepPlaceholder />);

    expect(screen.queryByText(/SIMULADO/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/TESTNET/i)).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FundingPage from "./page";

describe("FundingPage", () => {
  it("renders the step placeholder body", () => {
    render(<FundingPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Step content coming soon" })).toBeInTheDocument();
  });

  it("renders the relocated WorkspaceStatus probe labeled as a scaffold", () => {
    render(<FundingPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Vaqcrow Workspace" })).toBeInTheDocument();
    expect(screen.getByText(/scaffold/i)).toBeInTheDocument();
  });
});

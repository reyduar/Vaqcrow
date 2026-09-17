import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DistributionPage from "./page";

describe("DistributionPage", () => {
  it("renders the step placeholder body", () => {
    render(<DistributionPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Step content coming soon" })).toBeInTheDocument();
  });
});

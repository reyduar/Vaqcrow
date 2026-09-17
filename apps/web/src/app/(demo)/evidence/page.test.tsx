import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EvidencePage from "./page";

describe("EvidencePage", () => {
  it("renders the step placeholder body", () => {
    render(<EvidencePage />);

    expect(screen.getByRole("heading", { level: 2, name: "Step content coming soon" })).toBeInTheDocument();
  });
});

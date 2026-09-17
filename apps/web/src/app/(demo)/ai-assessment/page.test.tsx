import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AiAssessmentPage from "./page";

describe("AiAssessmentPage", () => {
  it("renders the step placeholder body", () => {
    render(<AiAssessmentPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Step content coming soon" })).toBeInTheDocument();
  });
});

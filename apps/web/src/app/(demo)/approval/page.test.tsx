import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ApprovalPage from "./page";

describe("ApprovalPage", () => {
  it("renders the step placeholder body", () => {
    render(<ApprovalPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Step content coming soon" })).toBeInTheDocument();
  });
});

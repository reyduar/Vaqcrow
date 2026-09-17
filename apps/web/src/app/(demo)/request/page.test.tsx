import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RequestPage from "./page";

describe("RequestPage", () => {
  it("renders the step placeholder body", () => {
    render(<RequestPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Step content coming soon" })).toBeInTheDocument();
  });
});

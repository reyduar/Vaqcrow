import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DemoStep } from "@/application/navigation/demo-steps";
import { DemoProgress } from "./demo-progress";

const step: DemoStep = { slug: "ai-assessment", label: "AI Assessment" };

describe("DemoProgress", () => {
  it("exposes the current step position and total step count", () => {
    render(<DemoProgress step={step} position={2} total={6} />);

    expect(screen.getByText("Step 2 of 6: AI Assessment")).toBeInTheDocument();
  });

  it("marks the current position with aria-current='step'", () => {
    render(<DemoProgress step={step} position={2} total={6} />);

    expect(screen.getByText("Step 2 of 6: AI Assessment")).toHaveAttribute(
      "aria-current",
      "step"
    );
  });

  it("reflects a different step's position and label", () => {
    const evidenceStep: DemoStep = { slug: "evidence", label: "Evidence" };

    render(<DemoProgress step={evidenceStep} position={6} total={6} />);

    expect(screen.getByText("Step 6 of 6: Evidence")).toBeInTheDocument();
  });
});

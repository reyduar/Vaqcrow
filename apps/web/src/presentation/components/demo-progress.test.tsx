import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DemoStep } from "@/application/navigation/demo-steps";
import { DemoProgress } from "./demo-progress";

const step: DemoStep = { slug: "ai-assessment", label: "Evaluación de IA" };

describe("DemoProgress", () => {
  it("exposes the current step position and total step count", () => {
    render(<DemoProgress step={step} position={2} total={6} />);

    expect(screen.getByText("Paso 2 de 6: Evaluación de IA")).toBeInTheDocument();
  });

  it("marks the current position with aria-current='step'", () => {
    render(<DemoProgress step={step} position={2} total={6} />);

    expect(screen.getByText("Paso 2 de 6: Evaluación de IA")).toHaveAttribute(
      "aria-current",
      "step"
    );
  });

  it("reflects a different step's position and label", () => {
    const evidenceStep: DemoStep = { slug: "evidence", label: "Evidencia" };

    render(<DemoProgress step={evidenceStep} position={6} total={6} />);

    expect(screen.getByText("Paso 6 de 6: Evidencia")).toBeInTheDocument();
  });
});

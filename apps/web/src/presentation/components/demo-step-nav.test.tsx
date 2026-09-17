import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DemoStep } from "@/application/navigation/demo-steps";
import { DemoStepNav } from "./demo-step-nav";

const previousStep: DemoStep = { slug: "request", label: "Request" };
const nextStep: DemoStep = { slug: "approval", label: "Approval" };

describe("DemoStepNav", () => {
  it("renders both previous and next links when both are present", () => {
    render(<DemoStepNav previous={previousStep} next={nextStep} />);

    expect(screen.getByRole("link", { name: /request/i })).toHaveAttribute("href", "/request");
    expect(screen.getByRole("link", { name: /approval/i })).toHaveAttribute("href", "/approval");
  });

  it("omits the previous link on the first step", () => {
    render(<DemoStepNav previous={null} next={nextStep} />);

    expect(screen.queryByRole("link", { name: /request/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /approval/i })).toBeInTheDocument();
  });

  it("omits the next link on the last step", () => {
    render(<DemoStepNav previous={previousStep} next={null} />);

    expect(screen.queryByRole("link", { name: /approval/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request/i })).toBeInTheDocument();
  });
});

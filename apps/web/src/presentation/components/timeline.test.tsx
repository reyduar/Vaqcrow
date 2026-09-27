import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Timeline, type TimelineStep } from "./timeline";

const STEPS: readonly TimelineStep[] = [
  { label: "Solicitud recibida", description: "Perfil, KYC y ventas guardados con su origen.", state: "done" },
  { label: "Evaluación de IA", description: "Organiza la evidencia y propone una banda de riesgo.", state: "current" },
  { label: "Decisión humana", state: "pending" }
];

describe("Timeline", () => {
  it("renders an ordered list with one item per step", () => {
    render(<Timeline steps={STEPS} />);

    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("marks the current step with aria-current=step and no other step", () => {
    render(<Timeline steps={STEPS} />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });

  it("conveys each step's state as visible text", () => {
    render(<Timeline steps={STEPS} />);

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("Completado")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Paso actual")).toBeInTheDocument();
    expect(within(items[2]!).getByText("Pendiente")).toBeInTheDocument();
  });

  it("renders the optional description only when provided", () => {
    render(<Timeline steps={STEPS} />);

    expect(screen.getByText("Perfil, KYC y ventas guardados con su origen.")).toBeInTheDocument();
    expect(screen.getByText("Organiza la evidencia y propone una banda de riesgo.")).toBeInTheDocument();

    const pendingItem = screen.getAllByRole("listitem")[2]!;
    expect(within(pendingItem).queryByText(/./, { selector: "p" })).not.toBeInTheDocument();
  });

  it("renders every step's label as visible text", () => {
    render(<Timeline steps={STEPS} />);

    for (const step of STEPS) {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    }
  });

  it("renders a connecting line between steps, but not after the last one", () => {
    render(<Timeline steps={STEPS} />);

    expect(document.querySelectorAll('[data-part="connector"]')).toHaveLength(STEPS.length - 1);
  });

  it("keeps the visual dot and connecting line decorative", () => {
    render(<Timeline steps={STEPS} />);

    const dots = document.querySelectorAll('[data-part="dot-wrapper"]');
    expect(dots).toHaveLength(3);
    dots.forEach((dot) => expect(dot).toHaveAttribute("aria-hidden", "true"));
  });
});

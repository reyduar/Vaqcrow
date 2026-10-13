import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HowItWorks } from "./how-it-works";

/**
 * 「La traza」 (#497). The words come from
 * `docs/guides/como-funciona-vaqcrow.md`; these cases pin the structure the
 * section promises and the contract between the document and the trust badges --
 * a badge that says `simulado` has to be backed by the stage's own text
 * (`docs/design/demo-ui.md` §2).
 */
describe("「Cómo funciona」 — La traza", () => {
  it("keeps the #como-funciona anchor and its heading", () => {
    const { container } = render(<HowItWorks />);

    expect(container.querySelector("section#como-funciona")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Cómo funciona" })).toBeTruthy();
  });

  it("renders the linear trace in order, with the two branches as the last fork's outcomes", () => {
    render(<HowItWorks />);

    const steps = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    const branches = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);

    expect(steps).toHaveLength(11);
    expect(steps[0]).toBe("La PyME crea su cuenta");
    expect(steps.at(-1)).toBe("La distribución mensual del revenue share");
    expect(branches).toEqual([
      "Meta alcanzada: la PyME recibe el capital",
      "Sin meta: reembolso a los contribuyentes"
    ]);
  });

  it("states the All-or-Nothing rule before it forks", () => {
    render(<HowItWorks />);

    expect(screen.getByRole("heading", { level: 3, name: "La meta: todo o nada" })).toBeTruthy();
  });

  it("every `simulado` badge is backed by the stage's own text", () => {
    const { container } = render(<HowItWorks />);
    const simulated = [...container.querySelectorAll('[data-variant="simulado"]')];

    expect(simulated.length).toBeGreaterThan(0);
    for (const badge of simulated) {
      expect(badge.closest("li")?.textContent ?? "").toMatch(/simulad|sintétic/i);
    }
  });

  it("renders the guide's inline markup as elements, never as literal markers", () => {
    const { container } = render(<HowItWorks />);

    expect(container.textContent ?? "").not.toContain("**");
    expect(container.textContent ?? "").not.toContain("`");
    expect(container.querySelector("strong")).not.toBeNull();
  });

  it("draws the trace with the project's reduced-motion guard", () => {
    const { container } = render(<HowItWorks />);
    const rail = container.querySelector("ol > span[aria-hidden='true']");

    expect(rail?.className).toContain("animate-traza");
    expect(rail?.className).toContain("motion-reduce:animate-none");
  });
});

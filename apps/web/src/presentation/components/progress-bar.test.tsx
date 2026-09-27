import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("renders role=progressbar with aria-valuenow/min/max and a visible label", () => {
    render(<ProgressBar label="Progreso de fondeo" value={630000} goal={1000000} />);

    const bar = screen.getByRole("progressbar", { name: "Progreso de fondeo" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "1000000");
    expect(bar).toHaveAttribute("aria-valuenow", "630000");
  });

  it("renders the current value and goal as visible text via formatValue", () => {
    render(
      <ProgressBar
        label="Progreso de fondeo"
        value={630000}
        goal={1000000}
        formatValue={(value, goal) => `$${value.toLocaleString("es-AR")} de $${goal.toLocaleString("es-AR")}`}
      />
    );

    expect(screen.getByText("$630.000 de $1.000.000")).toBeInTheDocument();
  });

  it("sets aria-valuetext in words from the formatted value", () => {
    render(
      <ProgressBar
        label="Progreso de fondeo"
        value={630000}
        goal={1000000}
        formatValue={() => "630.000 pesos de 1.000.000 pesos"}
      />
    );

    const bar = screen.getByRole("progressbar", { name: "Progreso de fondeo" });
    expect(bar).toHaveAttribute("aria-valuetext", "630.000 pesos de 1.000.000 pesos");
  });

  it("clamps the visible fill to 100% without altering the provided value", () => {
    render(<ProgressBar label="Progreso de fondeo" value={1500000} goal={1000000} />);

    const bar = screen.getByRole("progressbar", { name: "Progreso de fondeo" });
    const fill = bar.querySelector('[data-slot="progress-bar-fill"]') as HTMLElement | null;
    expect(fill?.style.width).toBe("100%");
  });

  it("never uses the success colour unless the caller explicitly marks the goal as reached", () => {
    render(<ProgressBar label="Progreso de fondeo" value={630000} goal={1000000} />);
    const inProgress = screen.getByRole("progressbar", { name: "Progreso de fondeo" });
    expect(inProgress.className).not.toContain("progress-bar--success");

    render(<ProgressBar label="Meta alcanzada" value={1000000} goal={1000000} isGoalReached />);
    const reached = screen.getByRole("progressbar", { name: "Meta alcanzada" });
    expect(reached.className).toContain("progress-bar--success");
  });
});

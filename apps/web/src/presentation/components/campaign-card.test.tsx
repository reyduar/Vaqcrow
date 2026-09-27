import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CampaignCard } from "./campaign-card";

const BASE_PROPS = {
  smeName: "Panadería Horizonte SRL",
  subtitle: "Panificación · Córdoba",
  raisedLabel: "Progreso de fondeo",
  raisedValue: 9_450_000,
  goal: 15_000_000,
  formatRaised: (value: number, goal: number) =>
    `ARS ${value.toLocaleString("es-AR")} de ARS ${goal.toLocaleString("es-AR")}`,
  revenueShareTerms: "4,5 % de ventas",
  riskLevel: "medium" as const,
  riskLabel: "Riesgo medio"
};

describe("CampaignCard", () => {
  it("renders the SME name as a heading, defaulting to level 3", () => {
    render(<CampaignCard {...BASE_PROPS} />);

    const heading = screen.getByRole("heading", { name: "Panadería Horizonte SRL" });
    expect(heading.tagName).toBe("H3");
  });

  it("renders the SME name at a caller-configured heading level", () => {
    render(<CampaignCard {...BASE_PROPS} headingLevel={2} />);

    const heading = screen.getByRole("heading", { name: "Panadería Horizonte SRL" });
    expect(heading.tagName).toBe("H2");
  });

  it("renders the optional subtitle", () => {
    render(<CampaignCard {...BASE_PROPS} />);

    expect(screen.getByText("Panificación · Córdoba")).toBeInTheDocument();
  });

  it("renders the funding progress via the shared ProgressBar with caller-formatted values", () => {
    render(<CampaignCard {...BASE_PROPS} />);

    const bar = screen.getByRole("progressbar", { name: "Progreso de fondeo" });
    expect(bar).toHaveAttribute("aria-valuenow", "9450000");
    expect(bar).toHaveAttribute("aria-valuemax", "15000000");
    expect(screen.getByText("ARS 9.450.000 de ARS 15.000.000")).toBeInTheDocument();
  });

  it("never uses the success colour unless the caller explicitly confirms the goal was reached", () => {
    render(<CampaignCard {...BASE_PROPS} />);
    const inProgress = screen.getByRole("progressbar", { name: "Progreso de fondeo" });
    expect(inProgress.className).not.toContain("progress-bar--success");

    render(<CampaignCard {...BASE_PROPS} isGoalReached />);
    const reached = screen.getAllByRole("progressbar", { name: "Progreso de fondeo" }).at(-1);
    expect(reached?.className).toContain("progress-bar--success");
  });

  it("renders an optional caller-formatted close date label", () => {
    render(<CampaignCard {...BASE_PROPS} closeDateLabel="Cierra el 30/11/2026" />);

    expect(screen.getByText("Cierra el 30/11/2026")).toBeInTheDocument();
  });

  it("renders the revenue-share terms as a dl with a fixed dt and the caller-formatted dd", () => {
    render(<CampaignCard {...BASE_PROPS} />);

    const dt = screen.getByText("Revenue share");
    const dl = dt.closest("dl");
    expect(dl).toHaveTextContent("4,5 % de ventas");
  });

  it.each(["low", "medium", "high"] as const)(
    "never lets a %s risk level read as success",
    (riskLevel) => {
      render(<CampaignCard {...BASE_PROPS} riskLevel={riskLevel} riskLabel="Riesgo del nivel" />);

      const badge = screen.getByText("Riesgo del nivel");
      expect(badge.getAttribute("data-tone")).not.toBe("success");
    }
  );

  it("renders a visible risk label, not colour alone", () => {
    render(<CampaignCard {...BASE_PROPS} riskLevel="high" riskLabel="Riesgo alto" />);

    expect(screen.getByText("Riesgo alto")).toBeInTheDocument();
  });

  it("renders a SIMULADO marker when synthetic values are shown", () => {
    render(<CampaignCard {...BASE_PROPS} simuladoLabel="SIMULADO" />);

    expect(screen.getByText("SIMULADO")).toBeInTheDocument();
  });

  it("renders no SIMULADO marker when omitted", () => {
    render(<CampaignCard {...BASE_PROPS} />);

    expect(screen.queryByText("SIMULADO")).not.toBeInTheDocument();
  });

  it("renders no action when omitted", () => {
    render(<CampaignCard {...BASE_PROPS} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a link action when the caller provides an href", () => {
    render(
      <CampaignCard
        {...BASE_PROPS}
        action={{ label: "Ver evidencia y riesgo", href: "/pymes/panaderia-horizonte" }}
      />
    );

    const link = screen.getByRole("link", { name: "Ver evidencia y riesgo" });
    expect(link).toHaveAttribute("href", "/pymes/panaderia-horizonte");
  });

  it("renders a button action when the caller provides onPress instead of href", () => {
    const onPress = vi.fn();
    render(<CampaignCard {...BASE_PROPS} action={{ label: "Marcar favorito", onPress }} />);

    screen.getByRole("button", { name: "Marcar favorito" }).click();
    expect(onPress).toHaveBeenCalledOnce();
  });
});

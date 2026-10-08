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

/**
 * Feature #414 (WU4b): the image header, top-right overlay slot and
 * caller-composed progress block the marketplace grid needs. The no-image
 * cases above stay untouched; these lock the with-image layout and the two new
 * extension points.
 */
const IMAGE = { src: "https://cdn.example.test/pyme.jpg", alt: "Foto de la panadería" };

describe("CampaignCard — image and marketplace extensions", () => {
  it("renders an image header with the caller's src and alt", () => {
    render(<CampaignCard {...BASE_PROPS} image={IMAGE} />);

    const img = screen.getByRole("img", { name: "Foto de la panadería" });
    expect(img).toHaveAttribute("src", "https://cdn.example.test/pyme.jpg");
  });

  it("overlays the risk and SIMULADO badges on the image and replaces the risk row with a close row", () => {
    render(<CampaignCard {...BASE_PROPS} simuladoLabel="SIMULADO" closeDateLabel="30/11/2026" image={IMAGE} />);

    expect(screen.getByText("SIMULADO")).toBeInTheDocument();
    expect(screen.getByText("Riesgo medio")).toBeInTheDocument();
    expect(screen.getByText("Cierre")).toBeInTheDocument();
    expect(screen.queryByText("Riesgo")).not.toBeInTheDocument();
  });

  it("renders the close date inside the details list (not under the bar) when an image is present", () => {
    render(<CampaignCard {...BASE_PROPS} closeDateLabel="Cierra el 30/11/2026" image={IMAGE} />);

    expect(screen.getByText("Cierre").closest("dl")).toHaveTextContent("Cierra el 30/11/2026");
    expect(screen.getAllByText("Cierra el 30/11/2026")).toHaveLength(1);
  });

  it("keeps the legacy layout without an image: SIMULADO next to the name, a risk row and the close under the bar", () => {
    render(<CampaignCard {...BASE_PROPS} simuladoLabel="SIMULADO" closeDateLabel="Cierra el 30/11/2026" />);

    expect(screen.getByText("Riesgo")).toBeInTheDocument();
    expect(screen.queryByText("Cierre")).not.toBeInTheDocument();
    expect(screen.getAllByText("Cierra el 30/11/2026")).toHaveLength(1);
  });

  it("renders overlayAction with and without an image", () => {
    const { unmount } = render(
      <CampaignCard {...BASE_PROPS} overlayAction={<button type="button">Corazón</button>} />
    );
    expect(screen.getByRole("button", { name: "Corazón" })).toBeInTheDocument();
    unmount();

    render(<CampaignCard {...BASE_PROPS} image={IMAGE} overlayAction={<button type="button">Corazón</button>} />);
    expect(screen.getByRole("button", { name: "Corazón" })).toBeInTheDocument();
  });

  it("lets progressSlot replace the built-in progress bar", () => {
    render(<CampaignCard {...BASE_PROPS} progressSlot={<div>Progreso del marketplace</div>} />);

    expect(screen.getByText("Progreso del marketplace")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("renders a neutral, labelled risk badge when only the label is provided (no level)", () => {
    render(<CampaignCard {...BASE_PROPS} riskLevel={null} riskLabel="Riesgo sin dato" />);

    const badge = screen.getByText("Riesgo sin dato").closest("[data-variant='risk']");
    expect(badge).toHaveAttribute("data-tone", "neutral");
    expect(badge?.querySelector("svg")).not.toBeNull();
  });

  it("renders no risk badge or row when riskLabel is omitted", () => {
    // Explicitly built without the risk props: `exactOptionalPropertyTypes`
    // rejects an explicit `undefined` for an optional prop.
    render(
      <CampaignCard
        smeName={BASE_PROPS.smeName}
        subtitle={BASE_PROPS.subtitle}
        raisedLabel={BASE_PROPS.raisedLabel}
        raisedValue={BASE_PROPS.raisedValue}
        goal={BASE_PROPS.goal}
        formatRaised={BASE_PROPS.formatRaised}
        revenueShareTerms={BASE_PROPS.revenueShareTerms}
      />
    );

    expect(screen.queryByText("Riesgo")).not.toBeInTheDocument();
  });

  it("separates the visible action label from its accessible name", () => {
    render(
      <CampaignCard
        {...BASE_PROPS}
        action={{
          label: "Ver evidencia y riesgo",
          ariaLabel: "Ver evidencia y riesgo de Panadería Horizonte SRL",
          href: "/campaigns/panaderia"
        }}
      />
    );

    const link = screen.getByRole("link", { name: "Ver evidencia y riesgo de Panadería Horizonte SRL" });
    expect(link).toHaveTextContent("Ver evidencia y riesgo");
  });

  it("omits the close row instead of rendering an empty value when an image has no close date", () => {
    render(<CampaignCard {...BASE_PROPS} image={IMAGE} />);

    expect(screen.queryByText("Cierre")).not.toBeInTheDocument();
  });
});

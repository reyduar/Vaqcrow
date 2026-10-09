import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PortfolioPosition } from "@/application/ports/portfolio-port";
import { PortfolioPositionCard } from "./portfolio-position-card";

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    campaignId: CAMPAIGN_ID,
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    contributionXlm: "250.0000000",
    raisedArs: 9_450_000,
    goalArs: 15_000_000,
    fundedPercentBps: 6_300,
    status: "funding",
    closeDate: "2026-11-30T12:00:00.000Z",
    vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
    ...overrides
  };
}

function renderCard(value: PortfolioPosition) {
  return render(
    <ul>
      <PortfolioPositionCard position={value} />
    </ul>
  );
}

describe("PortfolioPositionCard", () => {
  it("renders the position facts, progress and the funding status body", () => {
    renderCard(position());

    expect(screen.getByRole("heading", { level: 3, name: "Panadería Horizonte SRL" })).toBeInTheDocument();
    expect(screen.getByText("Alimentos · Córdoba")).toBeInTheDocument();
    expect(screen.getByText("SIMULADO")).toBeInTheDocument();
    expect(screen.getByText("Mi aporte")).toBeInTheDocument();
    expect(screen.getByText("250,0000000 XLM")).toBeInTheDocument();
    expect(screen.getByText("63 % de la meta")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progreso de Panadería Horizonte SRL" })).toBeInTheDocument();
    expect(screen.getByText("Fondeo abierto")).toBeInTheDocument();
    expect(screen.getByText("Podés retirar tu aporte hasta el cierre, el 30/11/2026.")).toBeInTheDocument();
  });

  it("links to the campaign with an accessible name", () => {
    renderCard(position());
    expect(screen.getByRole("link", { name: "Ver campaña Panadería Horizonte SRL" })).toHaveAttribute(
      "href",
      `/campaigns/${CAMPAIGN_ID}`
    );
  });

  it("renders the settled label with no body", () => {
    renderCard(position({ status: "settled" }));

    expect(screen.getByText("Meta alcanzada")).toBeInTheDocument();
    expect(screen.queryByText(/Podés retirar tu aporte/)).not.toBeInTheDocument();
  });

  it("renders the refunding label with no body", () => {
    renderCard(position({ status: "refunding" }));

    expect(screen.getByText("Reembolso disponible")).toBeInTheDocument();
    expect(screen.queryByText(/Podés retirar tu aporte/)).not.toBeInTheDocument();
  });

  it("renders the composed action slot when one is provided", () => {
    render(
      <ul>
        <PortfolioPositionCard
          position={position()}
          action={<button type="button">Retirar mi aporte</button>}
        />
      </ul>
    );

    expect(screen.getByRole("button", { name: "Retirar mi aporte" })).toBeInTheDocument();
  });

  it("renders no action slot by default", () => {
    renderCard(position());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

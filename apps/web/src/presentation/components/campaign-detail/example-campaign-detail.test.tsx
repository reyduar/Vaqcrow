import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EXAMPLE_CAMPAIGN_PATH } from "@/application/campaign/example-campaign";
import { ExampleCampaignDetail } from "./example-campaign-detail";

/**
 * Issue #481: the landing's placeholder CTA opens a fully synthetic campaign
 * detail (`/campaigns/example`) that reuses the real `CampaignDetailView`, is
 * visibly marked `SIMULADO`, calls no API/Stellar, and offers no contribution.
 */
describe("ExampleCampaignDetail (#481)", () => {
  it("exports the English example route", () => {
    expect(EXAMPLE_CAMPAIGN_PATH).toBe("/campaigns/example");
  });

  it("renders the synthetic example detail through the shared view", () => {
    render(<ExampleCampaignDetail />);

    expect(screen.getByRole("heading", { level: 1, name: "Panadería Horizonte SRL" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Sobre la PyME" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Evidencia de ventas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Recomendación de IA" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Decisión humana" })).toBeInTheDocument();
  });

  it("marks the page as SIMULADO and explains it is an example", () => {
    render(<ExampleCampaignDetail />);

    expect(screen.getAllByText("SIMULADO").length).toBeGreaterThan(0);
    expect(screen.getByText("Página de ejemplo")).toBeInTheDocument();
  });

  it("offers no contribution or withdraw action", () => {
    render(<ExampleCampaignDetail />);

    expect(screen.queryByRole("button", { name: /Aportar a la campaña/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retirar mi aporte/ })).not.toBeInTheDocument();
  });

  it("explains that actions are unavailable in the example", () => {
    render(<ExampleCampaignDetail />);

    expect(screen.getByText(/no se puede aportar/i)).toBeInTheDocument();
  });
});

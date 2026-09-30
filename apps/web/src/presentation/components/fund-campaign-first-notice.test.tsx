import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FundCampaignFirstNotice } from "./fund-campaign-first-notice";

describe("FundCampaignFirstNotice", () => {
  it("says the step needs a funded campaign first and links to the funding step", () => {
    render(<FundCampaignFirstNotice action="preparar la distribución" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Todavía no hay una campaña fondeada: primero hay que fondear la campaña para poder preparar la distribución."
    );
    expect(screen.getByRole("link", { name: "Ir al fondeo" })).toHaveAttribute("href", "/funding");
  });
});

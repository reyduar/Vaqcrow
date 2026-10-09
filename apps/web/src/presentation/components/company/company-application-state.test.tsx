import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApplicationReviewState } from "@vaqcrow/contracts";
import { CompanyApplicationState } from "./company-application-state";

function renderState(state: ApplicationReviewState | null) {
  return render(<CompanyApplicationState state={state} />);
}

describe("CompanyApplicationState", () => {
  it("renders «En revisión» for a request under assessment or human review", () => {
    renderState("human_review");

    const banner = screen.getByRole("region", { name: "Estado de tu solicitud" });
    expect(banner).toHaveTextContent("En revisión");
    expect(banner).toHaveTextContent("Todavía no está aprobada ni publicada.");
  });

  it("renders «Requiere cambios» for a request the review sent back", () => {
    renderState("changes_requested");

    expect(screen.getByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("Requiere cambios");
  });

  it("renders «Rechazada» for a rejected request", () => {
    renderState("rejected");

    expect(screen.getByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("Rechazada");
  });

  it("renders «Aprobada» for an approved request", () => {
    renderState("approved");

    expect(screen.getByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("Aprobada");
  });

  it("renders the pre-vault «Sin enviar» empty state for a null application", () => {
    renderState(null);

    expect(screen.getByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("Sin enviar");
  });
});

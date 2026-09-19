import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { simulatedAssessment } from "@/application/assessment/simulated-assessment";
import { AiAssessmentPanel } from "./ai-assessment-panel";

describe("AiAssessmentPanel", () => {
  it("labels the assessment as simulated, not live, and advisory only", () => {
    render(<AiAssessmentPanel assessment={simulatedAssessment} />);

    expect(screen.getAllByText("SIMULADO").length).toBeGreaterThan(0);
    expect(screen.getByText(/no corresponde a una llamada en vivo/i)).toBeInTheDocument();
    expect(screen.getByText(/solo asesora/i)).toBeInTheDocument();
  });

  it("shows risk band and confidence as separate labelled values", () => {
    render(<AiAssessmentPanel assessment={simulatedAssessment} />);

    expect(screen.getByText("Riesgo medio")).toBeInTheDocument();
    expect(screen.getByText("72 %")).toBeInTheDocument();
    expect(screen.getByText("Revisión humana")).toBeInTheDocument();
  });

  it("lists every reason with its cited evidence references", () => {
    render(<AiAssessmentPanel assessment={simulatedAssessment} />);

    const reasons = screen.getByRole("list", { name: "Razones" });
    const items = within(reasons).getAllByRole("listitem");
    expect(items).toHaveLength(simulatedAssessment.reasons.length);
    expect(within(reasons).getByText("missing:2026-04")).toBeInTheDocument();
    expect(within(reasons).getByText("sales:2026-06")).toBeInTheDocument();
  });

  it("shows uncertainty and pending questions", () => {
    render(<AiAssessmentPanel assessment={simulatedAssessment} />);

    expect(screen.getByRole("list", { name: "Incertidumbre" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Preguntas pendientes" })).toBeInTheDocument();
  });

  it("never renders an approve action or a decision control", () => {
    render(<AiAssessmentPanel assessment={simulatedAssessment} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
